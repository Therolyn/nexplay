import type { Category, Item, ItemType } from './types';

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class ProviderError extends Error {}

export async function fetchText(url: string, timeoutMs = 20000, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`);
  return await res.text();
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 60000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T;
}

/** Accept 'host', 'http://host:8080', 'host/player_api.php?...' → normalized panel origin. */
export function normalizeServer(server: string): URL {
  let s = (server || '').trim();
  if (!s) throw new ProviderError('Servidor Xtream não informado');
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  const u = new URL(s);
  if (u.pathname.includes('get.php')) {
    u.pathname = u.pathname.replace(/\/?[^/]*\.php.*$/, '/player_api.php');
  } else if (!u.pathname.includes('player_api.php')) {
    u.pathname = u.pathname.replace(/\/+$/, '') + '/player_api.php';
  }
  return u;
}

export function xtreamBase(server: string, username: string, password: string): string {
  const api = normalizeServer(server);
  const q = new URLSearchParams({ username, password });
  return `${api.origin}${api.pathname}?${q}`;
}

export function stripAccents(s: string): string {
  return s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}

export function normName(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normSeriesName(s: string): string {
  return normName(s)
    .replace(/\bs\d+e\d+\b/g, ' ')
    .replace(/\(\d{4}\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(1080p|720p|4k|hdtv|web-?dl|bluray|x264|x265|hevc|h264|hd|fhd|proper|repack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyM3UGroup(group: string, url: string): ItemType {
  const g = (group || '').toLowerCase();
  const u = (url || '').toLowerCase();
  if (/(serie|series|séries|série|episodio|episódio|episodes|tv shows|shows|temporada)/.test(g)) return 'series';
  if (/(movie|film|vod|filme|cinema|lancamento|lançamento)/.test(g)) return 'vod';
  if (u.includes('/series/') || u.includes('/episodes/')) return 'series';
  if (u.includes('/movies/') || u.includes('/movie/') || u.includes('/vod/') || /\.(mp4|mkv|avi|webm|mov)(\?|$)/.test(u)) return 'vod';
  return 'live';
}

export function catCounts(items: Item[]): Category[] {
  const m = new Map<string, number>();
  for (const c of items) m.set(c.group, (m.get(c.group) || 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Group-title is the app's category key; keep 'all' for "Todas as categorias". */
export function filterByCategory(items: Item[], cat: string): Item[] {
  if (!cat || cat === 'all') return items;
  return items.filter((i) => i.group === cat);
}

export function makeId(prefix: string, n: string | number): string {
  return prefix + String(n);
}

/** Extract a numeric stream id from an Xtream URL: .../{id}.ext */
export function streamIdFromUrl(url: string): string | null {
  const m = url.match(/\/(\d+)\.[a-z0-9]{2,5}(\?|$)/i);
  return m ? m[1] : null;
}
