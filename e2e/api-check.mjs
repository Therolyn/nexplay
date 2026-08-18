/* NexPlay Next - API end-to-end checks (mock provider + production build).
 * Usage: node e2e/api-check.mjs [baseUrl]
 * Requires: mock-server.mjs running on 8800 and `npm run build && npm run start`.
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:8800';
const USER = '99294464';
const PASS = '24579281';

let pass = 0;
let fail = 0;
const soft = [];

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function softOk(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    soft.push(name);
    console.log(`  ~ ${name}${detail ? ` — ${detail}` : ''} (soft)`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { res, text, json };
}

async function main() {
  console.log(`Base: ${BASE} | Mock: ${MOCK}`);

  // --- Xtream connect ---
  console.log('\n[1] Connect Xtream');
  const c = await api('/api/connect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'xtream', server: MOCK, username: USER, password: PASS }),
  });
  ok('POST /api/connect → ok', c.json?.ok === true, c.text.slice(0, 200));
  ok('counts.live = 96', c.json?.counts?.live === 96, `got ${c.json?.counts?.live}`);
  ok('counts.vod = 80', c.json?.counts?.vod === 80, `got ${c.json?.counts?.vod}`);
  ok('counts.series = 30', c.json?.counts?.series === 30, `got ${c.json?.counts?.series}`);
  ok('categorias live = 24', c.json?.categories?.live?.length === 24, `got ${c.json?.categories?.live?.length}`);
  ok('categorias vod = 10', c.json?.categories?.vod?.length === 10, `got ${c.json?.categories?.vod?.length}`);
  ok('categorias series = 6', c.json?.categories?.series?.length === 6, `got ${c.json?.categories?.series?.length}`);
  ok('first.vod preenchido', c.json?.first?.vod?.length > 0, `got ${c.json?.first?.vod?.length}`);
  ok('conn token presente', typeof c.json?.conn === 'string' && c.json.conn.length > 10);
  const xt = c.json.conn;

  // --- Items Xtream ---
  console.log('\n[2] Items Xtream (paginação)');
  const p0 = await api(`/api/items?conn=${encodeURIComponent(xt)}&type=live&cat=all&page=0`);
  ok('live page0 → 80 itens', p0.json?.items?.length === 80, `got ${p0.json?.items?.length}`);
  ok('live hasMore', p0.json?.hasMore === true);
  const p1 = await api(`/api/items?conn=${encodeURIComponent(xt)}&type=live&cat=all&page=1`);
  ok('live page1 → 16 itens', p1.json?.items?.length === 16, `got ${p1.json?.items?.length}`);
  ok('live sem duplicados entre páginas', p1.json.items.every((i) => !p0.json.items.some((j) => j.id === i.id)));

  const vp = await api(`/api/items?conn=${encodeURIComponent(xt)}&type=vod&cat=all&page=0`);
  ok('vod page0 → 80 itens', vp.json?.items?.length === 80, `got ${vp.json?.items?.length}`);
  ok('vod ordenado por added desc (primeiro id=101)', vp.json?.items?.[0]?.id === 'v101', `got ${vp.json?.items?.[0]?.id}`);
  ok('vod tem plot da lista', (vp.json?.items?.[0]?.plot || '').length > 10);
  ok('vod url XUI /movie/', /\/movie\/99294464\/24579281\/101\.mp4$/.test(vp.json?.items?.[0]?.url || ''));

  const sp = await api(`/api/items?conn=${encodeURIComponent(xt)}&type=series&cat=Drama&page=0`);
  ok('series cat=Drama → 5 itens', sp.json?.items?.length === 5, `got ${sp.json?.items?.length}`);
  ok('series total Drama = 5', sp.json?.total === 5);

  // --- VOD info + wiki fallback ---
  console.log('\n[3] VOD info');
  const v = await api(`/api/vod?conn=${encodeURIComponent(xt)}&vod_id=101`);
  ok('get_vod_info → plot do painel', (v.json?.info?.plot || '').length > 10, v.text.slice(0, 150));
  ok('info.rating presente', v.json?.info?.rating === '8');
  const vw = await api(`/api/vod?conn=${encodeURIComponent(xt)}&vod_id=102`);
  softOk('wiki fallback (Dreamgirls) preenche plot', (vw.json?.info?.plot || '').length > 40,
    `plot=${JSON.stringify((vw.json?.info?.plot || '').slice(0, 80))}`);

  // --- Series info ---
  console.log('\n[4] Series info');
  const s = await api(`/api/series?conn=${encodeURIComponent(xt)}&series_id=201`);
  ok('series info → nome', s.json?.info?.name === 'Série Drama 1', s.text.slice(0, 150));
  ok('2 temporadas', s.json?.seasons?.length === 2, `got ${s.json?.seasons?.length}`);
  ok('4 episódios na T1', s.json?.seasons?.[0]?.episodes?.length === 4, `got ${s.json?.seasons?.[0]?.episodes?.length}`);
  ok('episódio tem url XUI', /\/series\/99294464\/24579281\/\d+\.mp4$/.test(s.json?.seasons?.[0]?.episodes?.[0]?.url || ''));

  // --- EPG ---
  console.log('\n[5] EPG');
  const e = await api(`/api/epg?conn=${encodeURIComponent(xt)}&stream_id=1`);
  ok('epg listings presente', Array.isArray(e.json?.epg_listings) && e.json.epg_listings.length > 0);

  // --- M3U connect ---
  console.log('\n[6] Connect M3U (get.php)');
  const m3uUrl = `${MOCK}/get.php?username=${USER}&password=${PASS}&type=m3u_plus&output=ts`;
  const m = await api('/api/connect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'm3u', url: m3uUrl }),
  });
  ok('POST /api/connect (m3u) → ok', m.json?.ok === true, m.text.slice(0, 200));
  ok('m3u counts live=88', m.json?.counts?.live === 88, `got ${m.json?.counts?.live}`);
  ok('m3u counts vod=84', m.json?.counts?.vod === 84, `got ${m.json?.counts?.vod}`);
  ok('m3u counts series=244', m.json?.counts?.series === 244, `got ${m.json?.counts?.series}`);
  ok('painel detectado via get.php', m.json?.meta?.panel?.server === MOCK, JSON.stringify(m.json?.meta?.panel));
  ok('primeira série da home reconhecida', /Canal Séries|Série /.test(m.json?.first?.series?.[0]?.name || ''), `got ${m.json?.first?.series?.[0]?.name}`);
  const mt = m.json.conn;

  // --- Items M3U ---
  console.log('\n[7] Items M3U');
  const mp0 = await api(`/api/items?conn=${encodeURIComponent(mt)}&type=vod&cat=Filmes&page=0`);
  ok('m3u vod cat=Filmes → 80 itens', mp0.json?.items?.length === 80, `got ${mp0.json?.items?.length}`);
  const filmeReal = mp0.json?.items?.find((i) => i.name === 'Filme Ação 1');
  ok('m3u vod panelVodId do filme real = 101', filmeReal?.panelVodId === '101', `got ${filmeReal?.panelVodId}`);
  ok('m3u vod ids estáveis (v{idx global})', /^v\d+$/.test(mp0.json?.items?.[0]?.id || ''));
  const mp2 = await api(`/api/items?conn=${encodeURIComponent(mt)}&type=series&cat=Séries&page=0`);
  ok('m3u series cat=Séries → 80 itens (página 1)', mp2.json?.items?.length === 80, `got ${mp2.json?.items?.length}`);
  ok('m3u series cat=Séries total = 244', mp2.json?.total === 244, `got ${mp2.json?.total}`);

  // --- M3U series flow (series-search + series) ---
  console.log('\n[8] M3U → série via painel');
  const ss = await api(`/api/series-search?conn=${encodeURIComponent(mt)}&name=${encodeURIComponent('Série Drama 1')}`);
  ok('series-search acha match', ss.json?.ok === true && ss.json?.match?.series_id === '201', ss.text.slice(0, 150));
  const ms = await api(`/api/series?conn=${encodeURIComponent(mt)}&series_id=201`);
  ok('m3u series info → nome do painel', ms.json?.info?.name === 'Série Drama 1', ms.text.slice(0, 150));
  ok('m3u series seasons preenchidas', ms.json?.seasons?.length === 2);

  // --- M3U vod via painel ---
  console.log('\n[9] M3U → vod via painel');
  const mv = await api(`/api/vod?conn=${encodeURIComponent(mt)}&vod_id=101`);
  ok('m3u vod info com plot do painel', (mv.json?.info?.plot || '').length > 10, mv.text.slice(0, 150));

  // --- img + proxy ---
  console.log('\n[10] Imagens e proxy');
  const img = await api(`/api/img?url=${encodeURIComponent(`${MOCK}/logo/1.png`)}`);
  ok('/api/img → 200 png', img.res.status === 200 && img.res.headers.get('content-type')?.includes('image/png'));
  const prx = await api(`/api/proxy?url=${encodeURIComponent(`${MOCK}/${USER}/${PASS}/1.ts`)}`);
  ok('/api/proxy → 200 e bytes', prx.res.status === 200 && prx.res.headers.get('content-length') === '1000', `status=${prx.res.status}`);
  const prxRange = await fetch(`${BASE}/api/proxy?url=${encodeURIComponent(`${MOCK}/${USER}/${PASS}/1.ts`)}`, {
    headers: { Range: 'bytes=0-99' },
  });
  ok('proxy Range → 206 + Content-Range', prxRange.status === 206 && Boolean(prxRange.headers.get('content-range')), `status=${prxRange.status}`);

  console.log(`\nRESULTADO: ${pass} OK, ${fail} FALHAS${soft.length ? `, ${soft.length} soft (${soft.join(', ')})` : ''}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});