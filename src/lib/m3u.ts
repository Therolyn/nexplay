import { cached } from './cache';
import type { Category, ConnectionMeta, Item, ItemType } from './types';
import { classifyM3UGroup, fetchText, streamIdFromUrl } from './utils';
import { panelFromM3U } from './xtream';

const LIST_TTL = 10 * 60 * 1000;

interface RawBlock {
  name: string;
  logo: string;
  group: string;
  epgId: string;
  url: string;
}

export function m3uRaw(url: string): Promise<string> {
  return cached(`m3uraw|${url}`, LIST_TTL, () => fetchText(url, 120000)) as Promise<string>;
}

function* m3uBlocks(text: string): Generator<RawBlock> {
  const re = /#EXTINF:([^\r\n]*)\r?\n[ \t]*([^\r\n#][^\r\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const info = m[1];
    const url = m[2].trim();
    const name = (info.split(',').pop() || '').trim() || 'Sem nome';
    const attrs: Record<string, string> = {};
    for (const am of info.matchAll(/([a-z0-9_-]+)="([^"]*)"/gi)) attrs[am[1].toLowerCase()] = am[2];
    yield {
      name,
      logo: (attrs['tvg-logo'] || '').trim(),
      group: (attrs['group-title'] || 'Outros').trim(),
      epgId: (attrs['tvg-id'] || '').trim(),
      url,
    };
  }
}

function toItem(b: RawBlock, type: ItemType, globalIdx: number): Item {
  const item: Item = {
    id: `${type === 'live' ? 'x' : type === 'vod' ? 'v' : 's'}${globalIdx}`,
    name: b.name,
    logo: b.logo,
    group: b.group,
    type,
    epgId: b.epgId,
    rating: '',
    added: 0,
    plot: '',
    url: b.url,
  };
  if (type === 'vod') {
    const id = streamIdFromUrl(b.url);
    if (id) item.panelVodId = id;
  }
  return item;
}

export interface M3UScan {
  counts: Record<ItemType, number>;
  cats: Record<ItemType, Category[]>;
  items: Item[];
}

/** One full scan: per-type category counts + collected items (global ids). */
export function scanM3U(text: string, collectType: ItemType | null, collectCat: string | null, want: number): M3UScan {
  const counts: Record<ItemType, number> = { live: 0, vod: 0, series: 0 };
  const catMap: Record<ItemType, Map<string, number>> = { live: new Map(), vod: new Map(), series: new Map() };
  const items: Item[] = [];
  let globalIdx = 0;
  for (const b of m3uBlocks(text)) {
    const kind = classifyM3UGroup(b.group, b.url);
    counts[kind]++;
    catMap[kind].set(b.group, (catMap[kind].get(b.group) || 0) + 1);
    if (collectType && kind === collectType && (!collectCat || b.group === collectCat)) {
      items.push(toItem(b, kind, globalIdx));
      if (items.length >= want) break;
    }
    globalIdx++;
  }
  const cats = {} as Record<ItemType, Category[]>;
  for (const t of ['live', 'vod', 'series'] as ItemType[]) {
    cats[t] = [...catMap[t].entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
  return { counts, cats, items };
}

export async function connectM3U(url: string): Promise<{
  categories: Record<ItemType, Category[]>;
  first: Record<ItemType, Item[]>;
  counts: Record<ItemType, number>;
  meta: ConnectionMeta;
}> {
  const text = await m3uRaw(url);
  if (!/^#EXTM3U/i.test(text.trim())) throw new Error('Lista M3U vazia ou inválida');

  let panel: { server: string; username: string; password: string } | null = null;
  try {
    const u = new URL(url);
    const user = u.searchParams.get('username') || u.searchParams.get('user') || '';
    const pass = u.searchParams.get('password') || u.searchParams.get('pass') || '';
    if (user && pass) panel = { server: u.origin, username: user, password: pass };
  } catch { /* fallthrough */ }

  if (!panel) {
    const sample: string[] = [];
    for (const b of m3uBlocks(text)) {
      sample.push(b.url);
      if (sample.length >= 300) break;
    }
    panel = panelFromM3U(url, sample);
  }

  const full = scanM3U(text, null, null, 0);
  const first: Record<ItemType, Item[]> = {
    live: [],
    vod: [],
    series: [],
  };
  for (const t of ['live', 'vod', 'series'] as ItemType[]) {
    first[t] = scanM3U(text, t, null, 20).items;
  }
  if (full.counts.live + full.counts.vod + full.counts.series === 0) throw new Error('Lista M3U sem canais reconhecidos');

  return {
    categories: full.cats,
    first,
    counts: full.counts,
    meta: { mode: 'm3u', url, panel },
  };
}

export async function itemsM3U(url: string, type: ItemType, cat: string, page: number, pageSize = 80): Promise<{ items: Item[]; total: number }> {
  const text = await m3uRaw(url);
  const wantStart = page * pageSize;
  const wantEnd = wantStart + pageSize;
  const out: Item[] = [];
  let total = 0;
  let globalIdx = 0;
  for (const b of m3uBlocks(text)) {
    const kind = classifyM3UGroup(b.group, b.url);
    if (kind !== type) continue;
    if (cat && cat !== 'all' && b.group !== cat) continue;
    total++;
    if (globalIdx >= wantStart && globalIdx < wantEnd) out.push(toItem(b, kind, globalIdx));
    globalIdx++;
  }
  return { items: out, total };
}
