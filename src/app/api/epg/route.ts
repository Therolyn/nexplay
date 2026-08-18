import { NextRequest, NextResponse } from 'next/server';
import { epg } from '@/lib/xtream';
import { decodeConn, apiCreds } from '@/lib/conn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const conn = decodeConn(sp.get('conn') || '');
    const streamId = sp.get('stream_id') || '';
    if (!conn || !streamId) return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    const creds = apiCreds(conn);
    const r = await epg(creds.server, creds.username, creds.password, streamId);
    return NextResponse.json({ ...r, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
