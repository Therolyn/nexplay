/* NexPlay E2E - mock Xtream provider (deterministic, offline) */
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.MOCK_PORT || 8800);
const HOST = `http://127.0.0.1:${PORT}`;
const USER = '99294464';
const PASS = '24579281';

const LIVE_CATS = ['Esportes', 'Notícias', 'Filmes', 'Séries', 'Infantil', 'Documentários',
  'Música', 'Religião', 'Culinária', 'Viagem', 'Tecnologia', 'Saúde', 'Moda', 'Natureza',
  'História', 'Ciência', 'Animes', 'Reality', 'Entrevistas', 'Comédia', 'Terror',
  'Romance', 'Ação', 'Faroeste'];

const VOD_CATS = ['Ação', 'Comédia', 'Drama', 'Terror', 'Ficção', 'Romance', 'Animação', 'Suspense', 'Aventura', 'Documentário'];
const SERIES_CATS = ['Drama', 'Comédia', 'Crime', 'Fantasia', 'Mistério', 'Sci-Fi'];

const liveStreams = [];
LIVE_CATS.forEach((cat, ci) => {
  for (let n = 1; n <= 4; n++) {
    const id = ci * 4 + n;
    liveStreams.push({
      num: id, name: `Canal ${cat} ${n}`, stream_type: 'live', stream_id: id,
      stream_icon: id % 2 === 0 ? `${HOST}/logo/${id}.png` : '',
      epg_channel_id: `epg${id}`,
      added: String(1700000000 + id), category_id: String(ci + 1),
    });
  }
});

const vodStreams = [];
VOD_CATS.forEach((cat, ci) => {
  for (let n = 1; n <= 8; n++) {
    const id = 101 + ci * 8 + n - 1;
    vodStreams.push({
      num: id, name: `Filme ${cat} ${n}`, stream_type: 'movie', stream_id: id,
      stream_icon: `${HOST}/logo/${id}.png`, rating: String((n % 9) + 1),
      added: String(1700000000 - id), category_id: String(100 + ci + 1),
      container_extension: 'mp4',
      plot: `Sinopse do filme ${cat} ${n}. Uma história envolvente com reviravoltas, drama e ação para toda a família assistir.`,
    });
  }
});

const seriesList = [];
const seriesInfoMap = {};
SERIES_CATS.forEach((cat, ci) => {
  for (let n = 1; n <= 5; n++) {
    const id = 201 + ci * 5 + n - 1;
    const seasons = {};
    for (let s = 1; s <= 2; s++) {
      seasons[String(s)] = [];
      for (let e = 1; e <= 4; e++) {
        const eid = 10000 + id * 10 + s * 10 + e;
        seasons[String(s)].push({
          id: eid, episode_num: String(e), title: `${cat} ${n} - Temporada ${s} Episódio ${e}`,
          container_extension: 'mp4',
          info: { plot: `Episódio ${s}x${e} da série ${cat} ${n}.`, movie_image: `${HOST}/logo/${eid}.png` },
        });
      }
    }
    seriesInfoMap[String(id)] = {
      info: { name: `Série ${cat} ${n}`, plot: `Plot da série ${cat} ${n}.`, cast: 'Ator A, Atriz B',
        director: 'Diretor X', genre: cat, release_date: '2023', rating: String((n % 8) + 2), backdrop_path: `${HOST}/logo/${id}.png` },
      episodes: seasons,
    };
    seriesList.push({
      num: id, name: `Série ${cat} ${n}`, series_id: id, cover: `${HOST}/logo/${id}.png`,
      rating: String((n % 8) + 2), added: String(1700000000 - id), category_id: String(200 + ci + 1),
      container_extension: 'mp4',
      plot: `Plot da série ${cat} ${n}. História completa de drama e suspense com vários episódios.`,
    });
  }
});

const liveCatsJson = LIVE_CATS.map((n, i) => ({ category_id: String(i + 1), category_name: n, parent_id: 0 }));
const vodCatsJson = VOD_CATS.map((n, i) => ({ category_id: String(100 + i + 1), category_name: n, parent_id: 0 }));
const seriesCatsJson = SERIES_CATS.map((n, i) => ({ category_id: String(200 + i + 1), category_name: n, parent_id: 0 }));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f030005fe02fea72ec69f0000000049454e44ae426082', 'hex');
const FAKE_MP4 = Buffer.alloc(1000, 0x41);
const FAKE_TS = Buffer.alloc(376, 0x47);

function apiResponse(action, params) {
  switch (action) {
    case '':
      return {
        user_info: { username: USER, password: PASS, exp_date: '2027-01-01 00:00:00',
          max_connections: 3, status: 'Active', is_trial: '0' },
        server_info: { url: HOST, port: String(PORT), https_port: String(PORT), server_protocol: 'http' },
        live_streams: liveStreams, live_categories: liveCatsJson,
      };
    case 'get_live_categories': return liveCatsJson;
    case 'get_live_streams': return liveStreams;
    case 'get_vod_categories': return vodCatsJson;
    case 'get_vod_streams': return vodStreams;
    case 'get_series_categories': return seriesCatsJson;
    case 'get_series': return seriesList;
    case 'get_series_info': return seriesInfoMap[params.get('series_id')] || { info: {}, episodes: {} };
    case 'get_vod_info':
      if (params.get('vod_id') === '102') {
        return { info: { name: 'Dreamgirls', plot: '', cover: `${HOST}/logo/102.png` } };
      }
      return { info: { name: 'VOD', plot: 'Sinopse detalhada do filme.', rating: '8', genre: 'Ação',
        release_date: '2024', duration: '01:58:00', cover: `${HOST}/logo/101.png` } };
    case 'get_short_epg':
      return { epg_listings: [{ start: '1700000000', end: '1700003600', title: 'Programa 1', now_playing: 1 }] };
    default: return { error: 'unknown action' };
  }
}

function sendBytes(res, data, contentType) {
  const range = res.req.headers.range;
  if (range && /^bytes=\d+-\d*$/.test(range)) {
    const [startStr, endStr] = range.slice(6).split('-');
    const start = Number(startStr);
    const end = endStr ? Math.min(Number(endStr), data.length - 1) : data.length - 1;
    if (start >= data.length || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${data.length}`, 'Content-Length': '0' });
      res.end();
      return;
    }
    const slice = data.slice(start, end + 1);
    res.writeHead(206, {
      'Content-Type': contentType, 'Content-Length': slice.length,
      'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(slice);
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length, 'Access-Control-Allow-Origin': '*' });
  res.end(data);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, HOST);
  const parts = u.pathname.split('/').filter(Boolean);

  if (u.pathname.endsWith('player_api.php')) {
    const data = apiResponse(u.searchParams.get('action') || '', u.searchParams);
    const body = Buffer.from(JSON.stringify(data), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': body.length, 'Access-Control-Allow-Origin': '*' });
    res.end(body);
    return;
  }

  if (u.pathname.endsWith('get.php')) {
    const lines = ['#EXTM3U'];
    liveStreams.forEach(s => {
      const cat = LIVE_CATS[Number(s.category_id) - 1] || 'Outros';
      lines.push(`#EXTINF:-1 tvg-id="${s.epg_channel_id}" tvg-name="${s.name}" tvg-logo="${s.stream_icon}" group-title="${cat}",${s.name}`);
      lines.push(`${HOST}/${USER}/${PASS}/${s.stream_id}.ts`);
    });
    vodStreams.forEach(v => {
      lines.push(`#EXTINF:-1 tvg-id="" tvg-name="${v.name}" tvg-logo="${v.stream_icon}" group-title="Filmes",${v.name}`);
      lines.push(`${HOST}/${USER}/${PASS}/${v.stream_id}.ts`);
    });
    seriesList.forEach(sr => {
      const eps = seriesInfoMap[String(sr.series_id)].episodes;
      for (const [sn, list] of Object.entries(eps)) {
        for (const e of list) {
          const name = `${sr.name} - Temporada ${sn} Episódio ${e.episode_num}`;
          lines.push(`#EXTINF:-1 tvg-id="" tvg-name="${name}" tvg-logo="${e.info.movie_image}" group-title="Séries",${name}`);
          lines.push(`${HOST}/${USER}/${PASS}/${e.id}.ts`);
        }
      }
    });
    const body = Buffer.from(lines.join('\n'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl', 'Content-Length': body.length, 'Access-Control-Allow-Origin': '*' });
    res.end(body);
    return;
  }

  if (parts[0] === USER && parts[1] === PASS && parts[2]) {
    sendBytes(res, FAKE_MP4, 'video/mp4');
    return;
  }

  if (parts[0] === 'logo' && parts[1]) {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': PNG.length });
    res.end(PNG);
    return;
  }

  if (parts[0] === 'live' && parts[2] && parts[3]) {
    const file = parts[3];
    if (file.endsWith('.m3u8')) {
      const seg = `${HOST}/live/${USER}/${PASS}/seg_${file.replace('.m3u8', '')}.ts`;
      const body = Buffer.from(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXTINF:1.0,\n${seg}\n#EXT-X-ENDLIST\n`, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Content-Length': body.length });
      res.end(body);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': FAKE_TS.length });
    res.end(FAKE_TS);
    return;
  }

  if ((parts[0] === 'movie' || parts[0] === 'series') && parts[2] && parts[3]) {
    sendBytes(res, FAKE_MP4, 'video/mp4');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MOCK XTREAM em http://127.0.0.1:${PORT} (${liveStreams.length} canais, ${vodStreams.length} vod, ${seriesList.length} series)`);
});