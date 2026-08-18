import { NextRequest, NextResponse } from 'next/server';
import { connectM3U } from '@/lib/m3u';
import { connectXtream } from '@/lib/xtream';
import { encodeConn } from '@/lib/conn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    const mode = body.mode === 'm3u' ? 'm3u' : 'xtream';
    if (mode === 'xtream') {
      const server = (body.server || '').trim();
      const username = (body.username || '').trim();
      const password = body.password || '';
      if (!server || !username) return NextResponse.json({ ok: false, error: 'Servidor e usuário obrigatórios' }, { status: 400 });
      const r = await connectXtream(server, username, password);
      return NextResponse.json({ ok: true, ...r, conn: encodeConn(r.meta) });
    }
    const url = (body.url || '').trim();
    if (!url) return NextResponse.json({ ok: false, error: 'URL da lista M3U não informada' }, { status: 400 });
    const r = await connectM3U(url);
    return NextResponse.json({ ok: true, ...r, conn: encodeConn(r.meta) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
