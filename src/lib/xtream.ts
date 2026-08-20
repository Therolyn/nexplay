import { cached } from './cache';
import type { Category, ConnectionMeta, Episode, Item, ItemType, Season, SeriesInfo, VodInfo } from './types';
import { catCounts, fetchJson, filterByCategory, makeId, normalizeServer, normSeriesName, xtreamBase } from './utils';

const LIST_TTL = 10 * 60 * 1000;

export function connKey(server: string, user: string, pass: string) {
  return `${server}|${user}|${pass}`;
}

export function panelOrigin(server: string): string {
  return normalizeServer(server).origin;
}

function rawList(server: string, user: string, pass: string, action: string) {
  return cached(`xlist|${action}|${server}|${user}|${pass}`, LIST_TTL, async () => {
    const base = xtreamBase(server, user, pass);
    const data = (await fetchJson(base + `&action=${action}`)) as Record<string, unknown>[];
    return Array.isArray(data) ? data : [];
  });
}

/* ----------------------------- connect ----------------------------- */

interface XtreamListInfo {
  categories: Record<ItemType, Category[]>;
  first: Record<ItemType, Item[]>;
  counts: Record<ItemType, number>;
  meta: ConnectionMeta;
}

function toVodItem(v: Record<string, unknown>, server: string, username: string, password: string): Item {
  const vid = String(v.stream_id ?? '');
  const ext = String(v.container_extension || 'mp4');
  return {
    id: makeId('v', vid),
    name: String(v.name || 'Sem nome').trim(),
    logo: String(v.stream_icon || v.cover || ''),
    group: String(v.category_name || 'Filmes'),
    type: 'vod',
    rating: String(v.rating ?? ''),
    added: Number(v.added) || 0,
    plot: String(v.plot || '').trim().slice(0, 240),
    year: String(v.year ?? ''),
    genre: String(v.genre ?? ''),
    cast: String(v.cast ?? ''),
    director: String(v.director ?? ''),
    url: `${panelOrigin(server)}/movie/${username}/${password}/${vid}.${ext}`,
  };
}

function toSeriesItem(s: Record<string, unknown>, server: string, username: string, password: string): Item {
  const sid = String(s.series_id ?? '');
  const ext = String(s.container_extension || 'mp4');
  return {
    id: makeId('s', sid),
    name: String(s.name || 'Sem nome').trim(),
    logo: String(s.cover || s.stream_icon || ''),
    group: String(s.category_name || 'Séries'),
    type: 'series',
    rating: String(s.rating ?? ''),
    added: Number(s.added) || 0,
    plot: String(s.plot || '').trim().slice(0, 240),
    year: String(s.year ?? ''),
    genre: String(s.genre ?? ''),
    cast: String(s.cast ?? ''),
    director: String(s.director ?? ''),
    url: `${panelOrigin(server)}/series/${username}/${password}/${sid}.${ext}`,
  };
}

export async function connectXtream(server: string, username: string, password: string): Promise<XtreamListInfo> {
  const base = xtreamBase(server, username, password);
  const root = (await cached(`xroot|${connKey(server, username, password)}`, LIST_TTL, () =>
    fetchJson(base).catch(() => ({})))) as Record<string, unknown>;
  const userInfo = (root.user_info || {}) as Record<string, string>;
  const liveRaw = (root.live_streams || (await rawList(server, username, password, 'get_live_streams'))) as Record<string, string>[];
  const liveCats = (root.live_categories || (await rawList(server, username, password, 'get_live_categories'))) as Record<string, string>[];

  const catNames = new Map<string, string>();
  for (const c of liveCats) catNames.set(String(c.category_id), c.category_name || 'Outros');

  const origin = panelOrigin(server);
  const live: Item[] = liveRaw.map((s) => {
    const sid = String(s.stream_id ?? '');
    return {
      id: makeId('x', sid),
      name: (s.name || 'Sem nome').trim(),
      logo: s.stream_icon || '',
      group: catNames.get(String(s.category_id)) || 'Outros',
      type: 'live',
      epgId: s.epg_channel_id || '',
      rating: '',
      added: Number(s.added) || 0,
      plot: '',
      url: `${origin}/live/${username}/${password}/${sid}.m3u8`,
    };
  });

  const [vods, vodCats, series, seriesCats] = await Promise.all([
    rawList(server, username, password, 'get_vod_streams'),
    rawList(server, username, password, 'get_vod_categories'),
    rawList(server, username, password, 'get_series'),
    rawList(server, username, password, 'get_series_categories'),
  ]);

  const vodCatNames = new Map(vodCats.map((c) => [String(c.category_id), String(c.category_name || 'Filmes')]));
  const seriesCatNames = new Map(seriesCats.map((c) => [String(c.category_id), String(c.category_name || 'Séries')]));

  const vodsSorted = [...vods].sort((a, b) => (Number(b.added) || 0) - (Number(a.added) || 0));
  const seriesSorted = [...series].sort((a, b) => (Number(b.added) || 0) - (Number(a.added) || 0));

  const meta: ConnectionMeta = {
    mode: 'xtream',
    server: server.trim(),
    username,
    password,
    expires: userInfo.exp_date || '',
    maxConnections: userInfo.max_connections || '',
    panel: null,
  };

  return {
    categories: {
      live: catCounts(live),
      vod: vodCats.map((c) => ({ name: String(c.category_name || 'Filmes'), count: vods.filter((v) => String(v.category_id) === String(c.category_id)).length })),
      series: seriesCats.map((c) => ({ name: String(c.category_name || 'Séries'), count: series.filter((s) => String(s.category_id) === String(c.category_id)).length })),
    },
    first: {
      live: live.slice(0, 20),
      vod: vodsSorted.slice(0, 20).map((v) => toVodItem({ ...v, category_name: vodCatNames.get(String(v.category_id)) }, server, username, password)),
      series: seriesSorted.slice(0, 20).map((s) => toSeriesItem({ ...s, category_name: seriesCatNames.get(String(s.category_id)) }, server, username, password)),
    },
    counts: { live: live.length, vod: vods.length, series: series.length },
    meta,
  };
}

/* ------------------------------ items ------------------------------ */

export async function itemsXtream(
  server: string, username: string, password: string, type: ItemType, cat: string, page: number, pageSize = 80,
): Promise<{ items: Item[]; total: number }> {
  let items: Item[];
  if (type === 'live') {
    const root = (await fetchJson(xtreamBase(server, username, password)).catch(() => ({}))) as Record<string, unknown>;
    const liveRaw = (root.live_streams || (await rawList(server, username, password, 'get_live_streams'))) as Record<string, string>[];
    const liveCats = (root.live_categories || (await rawList(server, username, password, 'get_live_categories'))) as Record<string, string>[];
    const catNames = new Map(liveCats.map((c) => [String(c.category_id), c.category_name || 'Outros']));
    items = liveRaw.map((s) => {
      const sid = String(s.stream_id ?? '');
      return {
        id: makeId('x', sid),
        name: (s.name || 'Sem nome').trim(),
        logo: s.stream_icon || '',
        group: catNames.get(String(s.category_id)) || 'Outros',
        type: 'live',
        epgId: s.epg_channel_id || '',
        rating: '',
        added: Number(s.added) || 0,
        plot: '',
        url: `${panelOrigin(server)}/live/${username}/${password}/${sid}.m3u8`,
      };
    });
  } else if (type === 'vod') {
    const vods = await rawList(server, username, password, 'get_vod_streams');
    const cats = await rawList(server, username, password, 'get_vod_categories');
    const catNames = new Map(cats.map((c) => [String(c.category_id), c.category_name || 'Filmes']));
    items = vods
      .map((v) => toVodItem({ ...v, category_name: catNames.get(String(v.category_id)) }, server, username, password))
      .sort((a, b) => b.added - a.added);
  } else {
    const series = await rawList(server, username, password, 'get_series');
    const cats = await rawList(server, username, password, 'get_series_categories');
    const catNames = new Map(cats.map((c) => [String(c.category_id), c.category_name || 'Séries']));
    items = series
      .map((s) => toSeriesItem({ ...s, category_name: catNames.get(String(s.category_id)) }, server, username, password))
      .sort((a, b) => b.added - a.added);
  }

  const filtered = filterByCategory(items, cat);
  const total = filtered.length;
  const start = page * pageSize;
  return { items: filtered.slice(start, start + pageSize), total };
}

/* ------------------------------ vod ------------------------------ */

/** Best fuzzy match of `name` inside a provider list (by normalized title). */
function matchByName<T extends Record<string, unknown>>(list: T[], name: string): T | null {
  const q = normSeriesName(name);
  if (!q) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const row of list) {
    const vn = normSeriesName(String(row.name || ''));
    if (!vn) continue;
    let score = 0;
    if (vn === q) score = 10000;
    else if (q.length >= 3 && (vn.startsWith(q) || q.startsWith(vn))) score = Math.max(vn.length, q.length);
    else {
      const ta = new Set(q.split(' '));
      const tb = new Set(vn.split(' '));
      let inter = 0;
      for (const t of ta) if (tb.has(t)) inter++;
      if (ta.size && inter / ta.size >= 0.5) score = inter * 100;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function vodInfo(
  creds: { server: string; username: string; password: string } | null,
  vodId: string,
  name: string,
): Promise<{ info: VodInfo }> {
  let info: Record<string, unknown> = {};
  let md: Record<string, unknown> = {};
  let fromList: Record<string, unknown> | null = null;

  const fetchDetail = async (id: string) => {
    const base = xtreamBase(creds!.server, creds!.username, creds!.password);
    const data = (await fetchJson(base + `&action=get_vod_info&vod_id=${encodeURIComponent(id)}`)) as Record<string, unknown>;
    info = (data.info || {}) as Record<string, unknown>;
    md = (data.movie_data || {}) as Record<string, unknown>;
  };

  if (creds) {
    try {
      if (vodId) {
        await fetchDetail(vodId);
      } else if (name) {
        const list = await rawList(creds.server, creds.username, creds.password, 'get_vod_streams');
        const match = matchByName(list, name);
        if (match) {
          fromList = match;
          const id = String(match.stream_id ?? '');
          if (id) {
            try {
              await fetchDetail(id);
            } catch {
              /* keep list data */
            }
          }
        }
      }
    } catch {
      /* keep empty, fall back to list/wiki */
    }
  }

  const s = (k: string, obj: Record<string, unknown> = info): string => {
    const v = obj[k];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
    return v === null || v === undefined ? '' : String(v).trim();
  };

  const title = s('name') || name;

  let plot = s('plot') || s('description') || s('synopsis') || s('plot', md) || s('description', md) || s('synopsis', md);
  if (plot.trim().length < 40 && fromList) {
    plot = plot.trim() || s('plot', fromList) || s('description', fromList) || s('synopsis', fromList);
  }
  if (plot.trim().length < 40 && title) {
    const { wikiIntro } = await import('./wiki');
    plot = plot.trim() || (await wikiIntro(title));
  }

  let cover = s('cover') || s('movie_image') || s('backdrop_path') || (fromList ? s('cover', fromList) || s('movie_image', fromList) : '');
  if (cover && !/^https?:\/\//i.test(cover) && creds) {
    const origin = panelOrigin(creds.server);
    cover = `${origin}${cover.startsWith('/') ? '' : '/'}${cover}`;
  }

  return {
    info: {
      name: title,
      cover,
      plot: plot.slice(0, 600),
      rating: s('rating') || (fromList ? s('rating', fromList) : ''),
      genre: s('genre') || s('genres') || (fromList ? s('genre', fromList) : ''),
      year: s('release_date') || s('year') || (fromList ? s('year', fromList) : ''),
      duration: s('duration') || s('runtime'),
      cast: s('cast') || s('actors') || (fromList ? s('cast', fromList) : ''),
      director: s('director') || (fromList ? s('director', fromList) : ''),
    },
  };
}

/* ----------------------------- series ----------------------------- */

export async function seriesInfo(
  creds: { server: string; username: string; password: string } | null,
  seriesId: string,
  name: string,
): Promise<{ info: SeriesInfo; seasons: Season[] }> {
  let info: Record<string, unknown> = {};
  let md: Record<string, unknown> = {};
  let data: Record<string, unknown> = {};
  let fromList: Record<string, unknown> | null = null;

  if (creds) {
    try {
      let sid = seriesId;
      if (!sid && name) {
        const match = await seriesSearch(creds.server, creds.username, creds.password, name);
        sid = match?.series_id || '';
        if (match) fromList = match as unknown as Record<string, unknown>;
      }
      if (sid) {
        const base = xtreamBase(creds.server, creds.username, creds.password);
        data = (await fetchJson(base + `&action=get_series_info&series_id=${encodeURIComponent(sid)}`)) as Record<string, unknown>;
        info = (data.info || {}) as Record<string, unknown>;
        md = (data.movie_data || {}) as Record<string, unknown>;
      }
    } catch {
      /* keep empty, fall back to list/wiki */
    }
  }

  const origin = creds ? panelOrigin(creds.server) : '';

  const gv = (k: string, obj: Record<string, unknown> = info): string => {
    const v = obj[k];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
    return v === null || v === undefined ? '' : String(v).trim();
  };

  const raw = (data.episodes || []) as unknown;
  const flat: Record<string, unknown>[] = [];
  if (Array.isArray(raw)) {
    for (const e of raw as Record<string, unknown>[]) {
      const sn = String(e.season_number || e.season || '1');
      if (Array.isArray(e.episodes)) {
        for (const ep of e.episodes as Record<string, unknown>[]) flat.push({ ...ep, season: sn });
      } else {
        flat.push({ ...e, season: sn });
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [sn, eps] of Object.entries(raw as Record<string, unknown[]>)) {
      for (const ep of Array.isArray(eps) ? (eps as Record<string, unknown>[]) : []) flat.push({ ...ep, season: sn });
    }
  }

  const episodes: Episode[] = [];
  for (const e of flat) {
    const eid = String(e.id ?? '');
    if (!eid) continue;
    const ext = e.container_extension || info.container_extension || 'mp4';
    const einfo = (e.info || {}) as Record<string, unknown>;
    episodes.push({
      id: makeId('e', eid),
      season: String(e.season || e.season_number || '1'),
      number: String(e.episode_num || e.episode_number || ''),
      title: String(e.title || `Episódio ${e.episode_num || ''}`).trim(),
      plot: String(einfo.plot || einfo.description || einfo.synopsis || '').slice(0, 200),
      logo: String(einfo.movie_image || einfo.thumb || ''),
      url: `${origin}/series/${creds?.username || ''}/${creds?.password || ''}/${eid}.${ext}`,
    });
  }

  const seen: string[] = [];
  for (const e of episodes) if (!seen.includes(e.season)) seen.push(e.season);
  const seasons: Season[] = seen
    .map((season) => ({ season, episodes: episodes.filter((e) => e.season === season) }))
    .sort((a, b) => num(a.season) - num(b.season));
  for (const s of seasons) s.episodes.sort((a, b) => num(a.number) - num(b.number));

  const title = gv('name') || name;
  let plot = gv('plot') || gv('description') || gv('synopsis') || gv('plot', md) || gv('description', md);
  if (plot.trim().length < 40 && fromList) {
    plot = plot.trim() || String(fromList.plot || fromList.description || '');
  }
  if (plot.trim().length < 40 && title) {
    const { wikiIntro } = await import('./wiki');
    plot = plot.trim() || (await wikiIntro(title));
  }

  let cover = gv('cover') || gv('backdrop_path') || gv('poster_path') || (fromList ? String(fromList.cover || fromList.logo || '') : '');
  if (cover && !/^https?:\/\//i.test(cover) && origin) cover = `${origin}${cover.startsWith('/') ? '' : '/'}${cover}`;

  return {
    info: {
      name: title,
      cover,
      plot: plot.slice(0, 600),
      rating: gv('rating') || (fromList ? String(fromList.rating || '') : ''),
      genre: gv('genre') || gv('genres') || (fromList ? String(fromList.genre || '') : ''),
      year: gv('release_date') || gv('year') || (fromList ? String(fromList.year || '') : ''),
      cast: gv('cast') || gv('actors') || (fromList ? String(fromList.cast || '') : ''),
    },
    seasons,
  };
}

function num(s: string): number {
  return s && /^\d+$/.test(s) ? Number(s) : 1e9;
}

/* -------------------------- series search -------------------------- */

export async function seriesSearch(server: string, username: string, password: string, name: string) {
  const series = await rawList(server, username, password, 'get_series');
  const best = matchByName(series, name);
  if (!best) return null;
  return {
    series_id: String(best.series_id ?? ''),
    name: String(best.name || ''),
    plot: String(best.plot || '').trim().slice(0, 500),
    year: String(best.year ?? ''),
    rating: String(best.rating ?? ''),
    genre: String(best.genre ?? ''),
    logo: String(best.cover || best.stream_icon || ''),
  };
}

/* ------------------------------ epg ------------------------------ */

export async function epg(server: string, username: string, password: string, streamId: string) {
  const base = xtreamBase(server, username, password) + `&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}`;
  try {
    const data = (await fetchJson(base)) as Record<string, unknown>;
    const list = Array.isArray(data) ? data : (data.epg_listings || []);
    return { ok: true, epg_listings: list };
  } catch {
    return { ok: true, epg_listings: [] };
  }
}

/** Panel detection from M3U list url (get.php) or XUI stream urls. */
export function panelFromM3U(url: string, sampleUrls: string[]): { server: string; username: string; password: string } | null {
  try {
    const u = new URL(url);
    const user = u.searchParams.get('username') || u.searchParams.get('user') || u.searchParams.get('u') || '';
    const pass = u.searchParams.get('password') || u.searchParams.get('pass') || u.searchParams.get('p') || '';
    if (user && pass) return { server: u.origin, username: user, password: pass };
  } catch {
    /* keep going */
  }
  for (const raw of sampleUrls) {
    try {
      const cu = new URL(raw);
      const seg = cu.pathname.split('/').filter(Boolean);
      if (seg.length < 3) continue;
      if (/^(live|movie|movies|series|episodes|logo|img|images)$/.test(seg[0])) continue;
      return { server: cu.origin, username: seg[0], password: seg[1] };
    } catch {
      /* skip */
    }
  }
  return null;
}
