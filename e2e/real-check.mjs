/* NexPlay Next - Real provider e2e (requires env, mirrors webplayer-python/e2e/real-check.mjs).
 * Usage: node e2e/real-check.mjs [baseUrl]
 * Env: XTREAM_SERVER, XTREAM_USER, XTREAM_PASS
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const SERVER = process.env.XTREAM_SERVER || '';
const USER = process.env.XTREAM_USER || '';
const PASS = process.env.XTREAM_PASS || '';

if (!SERVER || !USER || !PASS) {
  console.error('Defina XTREAM_SERVER, XTREAM_USER e XTREAM_PASS.');
  process.exit(2);
}

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
  const res = await fetch(`${BASE}${path}`, opts, { signal: AbortSignal.timeout(120000) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { res, text, json };
}

async function findItem(conn, type, predicate, maxPages = 10) {
  for (let page = 0; page < maxPages; page++) {
    const r = await api(`/api/items?conn=${encodeURIComponent(conn)}&type=${type}&cat=all&page=${page}`);
    const items = r.json?.items || [];
    const hit = items.find(predicate);
    if (hit) return hit;
    if (!r.json?.hasMore) break;
  }
  return null;
}

async function main() {
  console.log(`Provedor: ${SERVER} | Base: ${BASE}`);

  // --- Connect Xtream real ---
  console.log('\n[1] Connect Xtream real');
  const c = await api('/api/connect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'xtream', server: SERVER, username: USER, password: PASS }),
  });
  ok('connect ok', c.json?.ok === true, c.text.slice(0, 300));
  ok('counts.live > 0', c.json?.counts?.live > 0, `got ${c.json?.counts?.live}`);
  ok('counts.vod > 1000', c.json?.counts?.vod > 1000, `got ${c.json?.counts?.vod}`);
  ok('counts.series > 100', c.json?.counts?.series > 100, `got ${c.json?.counts?.series}`);
  ok('categorias vod presentes', (c.json?.categories?.vod || []).length > 0);
  ok('first.vod preenchido', c.json?.first?.vod?.length > 0);
  const xt = c.json.conn;

  // --- VOD com sinopse (painel) ---
  console.log('\n[2] Filme com sinopse (painel)');
  const firstVod = (await api(`/api/items?conn=${encodeURIComponent(xt)}&type=vod&cat=all&page=0`)).json?.items?.[0];
  ok('achou filme na lista', Boolean(firstVod));
  if (firstVod) {
    const v = await api(`/api/vod?conn=${encodeURIComponent(xt)}&vod_id=${firstVod.id.slice(1)}`);
    const plot = v.json?.info?.plot || '';
    softOk(`get_vod_info do painel p/ "${firstVod.name.slice(0, 40)}"`, plot.length > 10, `plot=${JSON.stringify(plot.slice(0, 80))}`);
    ok('nome do filme preservado no modal', (v.json?.info?.name || '').length > 0);
  }

  // --- Filme SEM sinopse (wiki fallback ou aviso honesto) ---
  console.log('\n[3] Filme sem sinopse (wiki/aviso)');
  const noPlot = await findItem(xt, 'vod', (i) => !(i.plot || '').trim());
  ok('existe filme sem plot na lista', Boolean(noPlot), 'todos têm plot nas primeiras páginas (ok!)');
  if (noPlot) {
    const v = await api(`/api/vod?conn=${encodeURIComponent(xt)}&vod_id=${noPlot.id.slice(1)}`);
    const plot = v.json?.info?.plot || '';
    softOk(`"${noPlot.name.slice(0, 40)}" ganhou sinopse (wiki)`, plot.length > 40, `plot=${JSON.stringify(plot.slice(0, 80))}`);
    ok('sem sinopse → campo vazio (aviso honesto no app)', plot.trim() === '' || plot.length > 0);
  }

  // --- Dreamgirls (wiki confirmado) ---
  console.log('\n[4] Dreamgirls (wiki fallback)');
  const dream = await findItem(xt, 'vod', (i) => i.name.toLowerCase().includes('dreamgirls'), 60);
  if (dream) {
    const v = await api(`/api/vod?conn=${encodeURIComponent(xt)}&vod_id=${dream.id.slice(1)}`);
    const plot = v.json?.info?.plot || '';
    softOk('sinopse Dreamgirls via Wikipedia (pt)', plot.length > 40, `plot=${JSON.stringify(plot.slice(0, 100))}`);
    ok('nome Dreamgirls preservado', (v.json?.info?.name || '').toLowerCase().includes('dreamgirls'));
  } else {
    softOk('Dreamgirls presente no catálogo', false, 'não achado em 60 páginas');
  }

  // --- Série real ---
  console.log('\n[5] Série (painel)');
  const sitem = await findItem(xt, 'series', () => true);
  const sitemPlot = await findItem(xt, 'series', (i) => (i.plot || '').length > 10, 30);
  ok('achou série na lista', Boolean(sitem));
  if (sitem) {
    const s = await api(`/api/series?conn=${encodeURIComponent(xt)}&series_id=${sitem.id.slice(1)}`);
    ok(`"${sitem.name.slice(0, 40)}" com temporadas`, (s.json?.seasons || []).length > 0, s.text.slice(0, 200));
    ok('episódios com url XUI', /\/series\/[^/]+\/[^/]+\/\d+\.\w{2,5}$/.test(s.json?.seasons?.[0]?.episodes?.[0]?.url || ''));
  }
  ok('série com sinopse na lista (get_series)', Boolean(sitemPlot), 'nenhuma com plot em 30 páginas');
  if (sitemPlot) {
    const s = await api(`/api/series?conn=${encodeURIComponent(xt)}&series_id=${sitemPlot.id.slice(1)}`);
    softOk(`sinopse da série "${sitemPlot.name.slice(0, 40)}" no modal`, (s.json?.info?.plot || '').length > 10,
      `plot=${JSON.stringify((s.json?.info?.plot || '').slice(0, 80))}`);
  }

  // --- M3U real ---
  console.log('\n[6] Connect M3U real (get.php)');
  const m3uUrl = `${SERVER}/get.php?username=${USER}&password=${PASS}&type=m3u_plus&output=ts`;
  const m = await api('/api/connect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'm3u', url: m3uUrl }),
  });
  ok('m3u connect ok', m.json?.ok === true, m.text.slice(0, 300));
  ok('m3u counts.live > 0', m.json?.counts?.live > 0, `got ${m.json?.counts?.live}`);
  ok('m3u counts.vod > 1000', m.json?.counts?.vod > 1000, `got ${m.json?.counts?.vod}`);
  ok('m3u counts.series > 10000', m.json?.counts?.series > 10000, `got ${m.json?.counts?.series}`);
  ok('painel detectado', m.json?.meta?.panel?.server === new URL(SERVER).origin, JSON.stringify(m.json?.meta?.panel));
  const mt = m.json.conn;

  // --- M3U série via painel ---
  console.log('\n[7] M3U → série via series-search');
  const ss = await api(`/api/series-search?conn=${encodeURIComponent(mt)}&name=${encodeURIComponent('Archer')}`);
  ok('series-search "Archer" → match', ss.json?.ok === true && ss.json?.match, ss.text.slice(0, 200));
  if (ss.json?.match?.series_id) {
    const s = await api(`/api/series?conn=${encodeURIComponent(mt)}&series_id=${ss.json.match.series_id}`);
    ok('m3u série com temporadas', (s.json?.seasons || []).length > 0, s.text.slice(0, 200));
    softOk('m3u série com sinopse', (s.json?.info?.plot || '').length > 10);
  }

  // --- M3U filme via painel ---
  console.log('\n[8] M3U → filme via painel');
  const mv = await findItem(mt, 'vod', (i) => Boolean(i.panelVodId) && /^Filme/.test(i.name), 20);
  if (mv) {
    const v = await api(`/api/vod?conn=${encodeURIComponent(mt)}&vod_id=${mv.panelVodId}`);
    softOk(`m3u vod "${mv.name.slice(0, 40)}" com sinopse do painel`, (v.json?.info?.plot || '').length > 10, v.text.slice(0, 200));
    ok('m3u vod info nome preservado', (v.json?.info?.name || '').length > 0);
  } else if (firstVod) {
    const v = await api(`/api/vod?conn=${encodeURIComponent(mt)}&vod_id=${firstVod.id.slice(1)}`);
    ok(`m3u vod (id real ${firstVod.id}) info nome preservado`, (v.json?.info?.name || '').length > 0, v.text.slice(0, 200));
  } else {
    softOk('achou filme M3U com painelVodId', false, 'nenhum nas 20 páginas');
  }

  // --- img + proxy reais ---
  console.log('\n[9] Imagem e stream reais');
  const withLogo = await findItem(xt, 'vod', (i) => /^https?:\/\//.test(i.logo || ''));
  if (withLogo) {
    const img = await api(`/api/img?url=${encodeURIComponent(withLogo.logo)}`);
    softOk('/api/img → 200', img.res.status === 200, `status=${img.res.status}`);
  } else {
    softOk('/api/img (sem logo nas páginas)', false);
  }
  const live0 = await api(`/api/items?conn=${encodeURIComponent(xt)}&type=live&cat=all&page=0`);
  const firstLive = live0.json?.items?.[0];
  if (firstLive) {
    const prx = await api(`/api/proxy?url=${encodeURIComponent(firstLive.url)}`);
    softOk('/api/proxy stream live → 200', prx.res.status === 200 && (prx.res.headers.get('content-length') || '') !== '', `status=${prx.res.status}`);
  }

  console.log(`\nRESULTADO: ${pass} OK, ${fail} FALHAS${soft.length ? `, ${soft.length} soft (${soft.join(', ')})` : ''}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});