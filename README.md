# NexPlay Next

Player IPTV web para provedores **Xtream (XUI)** e listas **M3U**, com sinopses de filmes e séries (painel + fallback Wikipedia). Rewrite da versão Python em Next.js 16 + React + Tailwind, pronto para deploy no Vercel.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

## Testes

```bash
npm run build && npm run start   # produção (usado pelas suítes)

# Mock offline (porta 8800)
node e2e/mock-server.mjs

# 1) API contra o mock (45 checks)
node e2e/api-check.mjs

# 2) UI (Playwright, 27 checks)
node e2e/ui-check.mjs

# 3) Provedor real (requer env)
$env:XTREAM_SERVER="http://seuprovedor"
$env:XTREAM_USER="usuario"
$env:XTREAM_PASS="senha"
node e2e/real-check.mjs
```

## Deploy no Vercel

```bash
npx vercel        # primeiro deploy
npx vercel --prod # produção
```

Variáveis de ambiente (opcionais):

| Variável | Uso |
|---|---|
| `WIKI_API` | API da Wikipedia para fallback de sinopse (padrão: `https://pt.wikipedia.org/w/api.php`) |
| `NEXPLAY_ALLOWED_ORIGINS` | Se definida, o proxy de stream só aceita URLs dessas origens (vírgula separado) |

## Arquitetura

- **Cliente**: React + Zustand (tela de login, grade com paginação infinita, modais de filme/série, player com hls.js e fallback de proxy, favoritos locais).
- **Servidor** (`src/app/api/*`): route handlers que fazem proxy para o painel do usuário. Credenciais viajam em um token `base64url` sem estado (`?conn=`).
- **Cache**: LRU em memória por instância (10 min) — evita re-download de listas gigantes.
- **Modo M3U com painel**: detecta o painel pela URL do `get.php` ou pelas URLs dos streams, e reutiliza as APIs Xtream para sinopse/modal de séries (via `/api/series-search`).
- **Sinopse**: painel (`get_vod_info`/`get_series_info`) → Wikipedia (pt) → aviso honesto "Sinopse não disponível.".
- **Playback**: URL direta primeiro; em falha, `/api/proxy` com suporte a Range (206). Live/MPEG-TS via hls.js. Live longa pode cortar no Vercel (~60s por requisição) — é esperado; o proxy é fallback.

## Limitações conhecidas (Vercel free)

- Funções com duração limitada (~60s) e resposta ~4,5 MB: streaming via proxy pode interromper transmissões ao vivo longas. A URL direta do provedor é sempre tentada primeiro.
- Listas M3U gigantes (374k+ itens) são escaneadas por página no servidor; a primeira carga demora alguns segundos (cache por 10 min).
