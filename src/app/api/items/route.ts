import { NextRequest, NextResponse } from 'next/server';
import { itemsM3U } from '@/lib/m3u';
import { itemsXtream } from '@/lib/xtream';
import { decodeConn } from '@/lib/conn';
import type { ItemType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const conn = decodeConn(sp.get('conn') || '');
    const type = (sp.get('type') || 'live') as ItemType;
    const cat = sp.get('cat') || 'all';
    const page = Math.max(0, Number(sp.get('page') || '0') || 0);
    if (!conn) return NextResponse.json({ ok: false, error: 'Sessão inválida' }, { status: 400 });
    const r =
      conn.mode === 'm3u' && conn.url
        ? await itemsM3U(conn.url, type, cat, page)
        : await itemsXtream(conn.server || '', conn.username || '', conn.password || '', type, cat, page);
    return NextResponse.json({ ok: true, items: r.items, page, hasMore: (page + 1) * 80 < r.total, total: r.total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
