import { create } from 'zustand';
import type { Category, ConnectionMeta, Item, ItemType } from '@/lib/types';

export type ConnMode = 'xtream' | 'm3u';

export interface ConnectInput {
  mode: ConnMode;
  server?: string;
  username?: string;
  password?: string;
  url?: string;
}

interface PageData {
  items: Item[];
  total: number;
  hasMore: boolean;
  page: number;
}

interface AppState {
  conn: string | null;
  meta: ConnectionMeta | null;
  counts: Record<ItemType, number>;
  cats: Record<ItemType, Category[]>;
  type: ItemType;
  cat: string;
  pages: Record<string, PageData>;
  loading: boolean;
  connecting: boolean;
  error: string | null;
  search: string;
  favorites: Item[];
  modal: Item | null;
  player: { url: string; title: string } | null;
  connect: (input: ConnectInput) => Promise<void>;
  setType: (t: ItemType) => void;
  setCat: (c: string) => void;
  load: (page?: number) => Promise<void>;
  setSearch: (s: string) => void;
  toggleFavorite: (item: Item) => void;
  openItem: (item: Item) => void;
  closeModal: () => void;
  play: (url: string, title: string) => void;
  closePlayer: () => void;
  logout: () => void;
}

const PAGE_SIZE = 80;
const key = (type: ItemType, cat: string) => `${type}|${cat}`;

export function metaKey(meta: ConnectionMeta | null): string {
  if (!meta) return '';
  return meta.mode === 'm3u' ? meta.url || 'm3u' : meta.server || 'xtream';
}

function favKey(): string {
  return `nexplay_favs_${metaKey(useApp.getState().meta)}`;
}

export function loadFavorites(): Item[] {
  try {
    return JSON.parse(localStorage.getItem(favKey()) || '[]') as Item[];
  } catch {
    return [];
  }
}

function saveFavorites(items: Item[]) {
  try {
    localStorage.setItem(favKey(), JSON.stringify(items));
  } catch {
    /* storage full/blocked */
  }
}

const CREDS_KEY = 'nexplay_creds_v1';

export function loadSavedCreds(): ConnectInput | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ConnectInput;
    if (v?.mode !== 'xtream' && v?.mode !== 'm3u') return null;
    if (v.mode === 'xtream' && (!v.server || !v.username)) return null;
    if (v.mode === 'm3u' && !v.url) return null;
    return v;
  } catch {
    return null;
  }
}

function saveCreds(input: ConnectInput) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify(input));
  } catch {
    /* storage full/blocked */
  }
}

export function clearSavedCreds() {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    /* ignore */
  }
}

export const useApp = create<AppState>((set, get) => ({
  conn: null,
  meta: null,
  counts: { live: 0, vod: 0, series: 0 },
  cats: { live: [], vod: [], series: [] },
  type: 'live',
  cat: 'all',
  pages: {},
  loading: false,
  connecting: false,
  error: null,
  search: '',
  favorites: [],
  modal: null,
  player: null,

  connect: async (input) => {
    set({ connecting: true, error: null });
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!data.ok || typeof data.conn !== 'string') throw new Error(String(data.error || 'Falha ao conectar'));
      const conn = data.conn as string;
      const meta = data.meta as ConnectionMeta;
      const counts = data.counts as Record<ItemType, number>;
      const cats = data.categories as Record<ItemType, Category[]>;
      const pages: Record<string, PageData> = {};
      const first = (data.first as Record<ItemType, Item[]>) || { live: [], vod: [], series: [] };
      pages[key('live', 'all')] = { items: first.live || [], total: counts.live, hasMore: (first.live || []).length < counts.live, page: 0 };
      saveCreds(input);
      sessionStorage.removeItem('nexplay_logged_out');
      set({ conn, meta, counts, cats, pages, type: 'live', cat: 'all', search: '', favorites: loadFavorites() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ connecting: false });
    }
  },

  setType: (t) => set({ type: t, cat: 'all' }),
  setCat: (c) => set({ cat: c }),

  load: async (page = 0) => {
    const { conn, type, cat } = get();
    if (!conn) return;
    const k = key(type, cat);
    const existing = get().pages[k];
    if (page > 0 && existing && existing.page >= page) return;
    if (existing && existing.items.length > 0 && page === 0) return;
    set({ loading: true, error: null });
    try {
      const res = await fetch(
        `/api/items?conn=${encodeURIComponent(conn)}&type=${type}&cat=${encodeURIComponent(cat)}&page=${page}`,
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!data.ok) throw new Error(String(data.error || 'Falha ao carregar'));
      const items = (data.items as Item[]) || [];
      const prev = page === 0 ? [] : get().pages[k]?.items || [];
      set({
        pages: {
          ...get().pages,
          [k]: {
            items: [...prev, ...items],
            total: Number(data.total) || 0,
            hasMore: Boolean(data.hasMore),
            page,
          },
        },
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  setSearch: (s) => set({ search: s }),

  toggleFavorite: (item) => {
    const cur = get().favorites;
    const has = cur.some((f) => f.id === item.id);
    const next = has ? cur.filter((f) => f.id !== item.id) : [...cur, item];
    set({ favorites: next });
    saveFavorites(next);
  },

  openItem: (item) => {
    if (item.type === 'live') {
      get().play(item.url, item.name);
    } else {
      set({ modal: item });
    }
  },

  closeModal: () => set({ modal: null }),
  play: (url, title) => set({ player: { url, title } }),
  closePlayer: () => set({ player: null }),

  logout: () => {
    try {
      sessionStorage.setItem('nexplay_logged_out', '1');
    } catch {
      /* ignore */
    }
    set({ conn: null, meta: null, pages: {}, favorites: [], modal: null, player: null, error: null, search: '' });
  },
}));

export { PAGE_SIZE };