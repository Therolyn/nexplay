import { NextRequest } from 'next/server';
import { BROWSER_UA } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) return new Response('url inválida', { status: 400 });
  try {
    const target = new URL(url);
    const upstream = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Referer: `${target.origin}/`, Accept: 'image/*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) return new Response('imagem indisponível', { status: 404 });
    const blob = await upstream.arrayBuffer();
    return new Response(blob, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('imagem indisponível', { status: 404 });
  }
}