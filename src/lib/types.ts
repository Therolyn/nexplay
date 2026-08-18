export type ItemType = 'live' | 'vod' | 'series';

export interface Item {
  id: string;
  name: string;
  logo: string;
  group: string;
  type: ItemType;
  rating: string;
  added: number;
  plot: string;
  year?: string;
  genre?: string;
  cast?: string;
  director?: string;
  epgId?: string;
  /** Stream id extracted from an M3U url (Xtream panel linking). */
  panelVodId?: string;
  /** Raw provider url (played direct or through /api/proxy). */
  url: string;
}

export interface Category {
  name: string;
  count: number;
}

export interface PanelInfo {
  server: string;
  username: string;
  password: string;
}

export interface ConnectionMeta {
  mode: 'xtream' | 'm3u';
  server?: string;
  username?: string;
  password?: string;
  url?: string;
  expires?: string;
  maxConnections?: string;
  panel: PanelInfo | null;
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
  categories: Record<ItemType, Category[]>;
  first: Record<ItemType, Item[]>;
  counts: Record<ItemType, number>;
  meta: ConnectionMeta;
}

export interface ItemsResult {
  ok: boolean;
  items: Item[];
  page: number;
  hasMore: boolean;
  total: number;
  error?: string;
}

export interface VodInfo {
  name: string;
  cover: string;
  plot: string;
  rating: string;
  genre: string;
  year: string;
  duration: string;
  cast: string;
  director: string;
}

export interface Episode {
  id: string;
  season: string;
  number: string;
  title: string;
  plot: string;
  logo: string;
  url: string;
}

export interface Season {
  season: string;
  episodes: Episode[];
}

export interface SeriesInfo {
  name: string;
  cover: string;
  plot: string;
  rating: string;
  genre: string;
  year: string;
  cast: string;
}

export const TYPE_LABEL: Record<ItemType, string> = {
  live: 'AO VIVO',
  vod: 'FILME',
  series: 'SÉRIE',
};
