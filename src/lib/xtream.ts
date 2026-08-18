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
    const root = (await fetchJson(xtreamBase(server, username, password))) as Record<string, unknown>;
    const liveRaw = (root.live_streams || []) as Record<string, string>[];
    const liveCats = (root.live_categories || []) as Record<string, string>[];
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

export async function vodInfo(server: string, username: string, password: string, vodId: string): Promise<{ info: VodInfo }> {
  const base = xtreamBase(server, username, password);
  const data = (await fetchJson(base + `&action=get_vod_info&vod_id=${encodeURIComponent(vodId)}`)) as Record<string, unknown>;
  const info = (data.info || {}) as Record<string, unknown>;
  const md = (data.movie_data || {}) as Record<string, unknown>;

  const s = (k: string, obj: Record<string, unknown> = info): string => {
    const v = obj[k];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
    return v === null || v === undefined ? '' : String(v).trim();
  };

  let plot = s('plot') || s('description') || s('synopsis') || s('plot', md) || s('description', md) || s('synopsis', md);
  if (plot.trim().length < 40) {
    const { wikiIntro } = await import('./wiki');
    plot = plot.trim() || (await wikiIntro(s('name')));
  }

  let cover = s('cover') || s('movie_image') || s('backdrop_path');
  if (cover && !/^https?:\/\//i.test(cover)) {
    const origin = panelOrigin(server);
    cover = `${origin}${cover.startsWith('/') ? '' : '/'}${cover}`;
  }

  return {
    info: {
      name: s('name'),
      cover,
      plot: plot.slice(0, 600),
      rating: s('rating'),
      genre: s('genre') || s('genres'),
      year: s('release_date') || s('year'),
      duration: s('duration') || s('runtime'),
      cast: s('cast') || s('actors'),
      director: s('director'),
    },
  };
}

/* ----------------------------- series ----------------------------- */

export async function seriesInfo(server: string, username: string, password: string, seriesId: string): Promise<{ info: SeriesInfo; seasons: Season[] }> {
  const base = xtreamBase(server, username, password);
  const data = (await fetchJson(base + `&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`)) as Record<string, unknown>;
  const info = (data.info || {}) as Record<string, unknown>;
  const md = (data.movie_data || {}) as Record<string, unknown>;
  const origin = panelOrigin(server);

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
      url: `${origin}/series/${username}/${password}/${eid}.${ext}`,
    });
  }

  const seen: string[] = [];
  for (const e of episodes) if (!seen.includes(e.season)) seen.push(e.season);
  const seasons: Season[] = seen
    .map((season) => ({ season, episodes: episodes.filter((e) => e.season === season) }))
    .sort((a, b) => num(a.season) - num(b.season));
  for (const s of seasons) s.episodes.sort((a, b) => num(a.number) - num(b.number));

  const name = gv('name');
  let plot = gv('plot') || gv('description') || gv('synopsis') || gv('plot', md) || gv('description', md);
  if (plot.trim().length < 40) {
    const { wikiIntro } = await import('./wiki');
    plot = plot.trim() || (await wikiIntro(name));
  }

  let cover = gv('cover') || gv('backdrop_path') || gv('poster_path');
  if (cover && !/^https?:\/\//i.test(cover)) cover = `${origin}${cover.startsWith('/') ? '' : '/'}${cover}`;

  return {
    info: {
      name,
      cover,
      plot: plot.slice(0, 600),
      rating: gv('rating'),
      genre: gv('genre') || gv('genres'),
      year: gv('release_date') || gv('year'),
      cast: gv('cast') || gv('actors'),
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
  const q = normSeriesName(name);
  if (!q) return null;
  let best: Record<string, unknown> | null = null;
  let bestScore = 0;
  for (const s of series) {
    const sn = normSeriesName(String(s.name || ''));
    if (!sn) continue;
    let score = 0;
    if (sn === q) score = 10000;
    else if (q.length >= 3 && (sn.startsWith(q) || q.startsWith(sn))) score = Math.max(sn.length, q.length);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
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
