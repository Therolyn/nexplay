import type { ConnectionMeta } from './types';

/**
 * Stateless connection token: base64url(JSON) with the provider credentials
 * needed to resolve later /api/items, /api/vod, /api/series calls.
 * Survives serverless instance recycling (no registry).
 */
export interface ConnPayload {
  mode: 'xtream' | 'm3u';
  server?: string;
  username?: string;
  password?: string;
  url?: string;
  panel?: { server: string; username: string; password: string } | null;
}

export function encodeConn(meta: ConnectionMeta): string {
  const payload: ConnPayload = {
    mode: meta.mode,
    server: meta.server,
    username: meta.username,
    password: meta.password,
    url: meta.url,
    panel: meta.panel,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeConn(token: string): ConnPayload | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf-8')) as ConnPayload;
  } catch {
    return null;
  }
}

/** Credentials to call provider metadata endpoints (vod/series/search). */
export function apiCreds(conn: ConnPayload): { server: string; username: string; password: string } {
  const p = conn.panel;
  if (conn.mode === 'xtream' && conn.server) {
    return { server: conn.server, username: conn.username || '', password: conn.password || '' };
  }
  if (p && p.server && p.username && p.password) return p;
  throw new Error('Conexão sem painel (provedor não detectado)');
}
