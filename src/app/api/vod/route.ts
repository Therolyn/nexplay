import { NextRequest, NextResponse } from 'next/server';
import { vodInfo } from '@/lib/xtream';
import { decodeConn, apiCreds } from '@/lib/conn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const conn = decodeConn(sp.get('conn') || '');
    const vodId = sp.get('vod_id') || '';
    if (!conn || !vodId) return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    const creds = apiCreds(conn);
    const r = await vodInfo(creds.server, creds.username, creds.password, vodId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
