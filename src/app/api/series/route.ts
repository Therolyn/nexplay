import { NextRequest, NextResponse } from 'next/server';
import { seriesInfo } from '@/lib/xtream';
import { decodeConn, apiCreds } from '@/lib/conn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const conn = decodeConn(sp.get('conn') || '');
    const seriesId = sp.get('series_id') || '';
    const name = (sp.get('name') || '').trim();
    if (!conn || (!seriesId && !name)) return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    let creds = null;
    try {
      creds = apiCreds(conn);
    } catch {
      /* m3u sem painel: só fallback por nome (Wikipedia) */
    }
    const r = await seriesInfo(creds, seriesId, name);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}