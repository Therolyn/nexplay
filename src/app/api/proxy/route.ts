import { NextRequest } from 'next/server';
import { BROWSER_UA } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_ORIGINS = (process.env.NEXPLAY_ALLOWED_ORIGINS || '').split(',').filter(Boolean);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) return new Response('url inválida', { status: 400 });
  try {
    const target = new URL(url);
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(target.origin)) {
      return new Response('origem não permitida', { status: 403 });
    }
  } catch {
    return new Response('url inválida', { status: 400 });
  }

  const range = req.headers.get('range') || '';
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Referer: `${new URL(req.url).origin}/`,
    Accept: '*/*',
  };
  if (range) headers.Range = range;

  const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  const ok = upstream.ok || upstream.status === 206 || upstream.status === 416;
  if (!ok) return new Response(`upstream ${upstream.status}`, { status: 502 });

  const res = new Headers();
  res.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const cl = upstream.headers.get('content-length');
  if (cl) res.set('Content-Length', cl);
  res.set('Accept-Ranges', 'bytes');
  res.set('Cache-Control', 'no-cache, no-store');
  res.set('Access-Control-Allow-Origin', '*');
  if (upstream.status === 206) {
    const cr = upstream.headers.get('content-range');
    if (cr) {
      res.set('Content-Range', cr);
      const m = cr.match(/bytes (\d+)-(\d+)\/\d+|\*/);
      if (m && !cl) res.set('Content-Length', String(Number(m[2]) - Number(m[1]) + 1));
    }
  }
  if (upstream.status === 416) {
    const cr = upstream.headers.get('content-range');
    if (cr) res.set('Content-Range', cr);
  }

  return new Response(upstream.body, { status: upstream.status, headers: res });
}