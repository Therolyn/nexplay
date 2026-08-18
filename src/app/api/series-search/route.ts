import { NextRequest, NextResponse } from 'next/server';
import { seriesSearch } from '@/lib/xtream';
import { decodeConn, apiCreds } from '@/lib/conn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const conn = decodeConn(sp.get('conn') || '');
    const name = (sp.get('name') || '').trim();
    if (!conn || !name) return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    const creds = apiCreds(conn);
    const match = await seriesSearch(creds.server, creds.username, creds.password, name);
    return NextResponse.json({ ok: true, match });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
