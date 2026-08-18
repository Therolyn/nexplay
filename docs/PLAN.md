# NexPlay Next — Plano de Migração para Next.js + Vercel

## Objetivo
Reescrever o NexPlay (hoje `webplayer-python`, servidor Python stdlib + JS vanilla) em **Next.js (App Router) + React + Tailwind**, deployável no **Vercel**, eliminando os problemas recorrentes:
- Portas/processos Python no Windows
- DNS local instável (`primetop.fun`)
- Listas gigantes estourando limites de resposta
- Proxy de streaming frágil
- Frontend legado (JS vanilla, modais manuais)

## Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Framework | Next.js App Router (create-next-app latest) + React 19 + Tailwind v4 | Nativo Vercel, RSC + route handlers |
| Estado do front | Zustand (store global) + localStorage (favoritos/sessão) | Leve, sem server state |
| API | Route handlers em `app/api/*` | Um deploy, sem backend separado |
| Cache de listas | Módulo global em memória (por instância) + LRU ~10min | Funciona no serverless (module scope persiste por instância) |
| Listas M3U gigantes (374k) | Não parsear tudo na resposta: manter **texto bruto** em cache e **escaneamento por categoria/página** no request | Resposta pequena (limite 4,5MB do free) + memória baixa |
| Listas Xtream (23k vod) | Fetch por tipo, cache global, **paginação server-side** | Mesmo motivo |
| Sinopse | Painel (get_vod_info/get_series_info) → fallback **Wikipedia** (pt, sem chave, heurística de validação) | Mantém cobertura ~90% |
| M3U + painel | Detecção de painel Xtream (query do get.php OU URLs `user/pass/id.ts`), `panel_vod_id`, `/api/series-search` | Porta o que já funciona |
| Proxy de streams | Route handler com streaming + Range; `maxDuration=60`; front tenta **URL direta** primeiro, proxy como fallback | Limite de duração no free — documentar limite |
| Imagens (logos 403) | Rota `/api/img?url=` (proxy com UA de navegador) | Resolve anti-hotlink |
| Testes | Portar mock Xtream (Node) + auditoria Playwright (Playwright test ou script próprio) | Mesma cobertura (99 checks) |
| Variáveis | `NEXPLAY_PROXY` (URL de proxy de streams opcional), `WIKI_API` | Flexibilidade de deploy |

## Estrutura

```
nexplay-next/
├── app/
│   ├── layout.tsx, page.tsx          # shell + login
│   ├── api/
│   │   ├── connect/route.ts          # Xtream ou M3U (meta + categorias + 1ª página)
│   │   ├── items/route.ts            # ?conn=&type=&cat=&page=  (paginado)
│   │   ├── vod/route.ts              # get_vod_info + wiki fallback
│   │   ├── series/route.ts           # get_series_info
│   │   ├── series-search/route.ts    # busca fuzzy (cache get_series)
│   │   ├── epg/route.ts              # get_short_epg
│   │   ├── proxy/route.ts            # streaming + Range (áudio/vídeo/playlists)
│   │   └── img/route.ts              # proxy de imagens (logos/capas)
├── lib/
│   ├── xtream.ts                     # API do painel (fetch, UA, normalize)
│   ├── m3u.ts                        # parser streaming + detecção de painel
│   ├── wiki.ts                       # fallback Wikipedia (pt) + heurística
│   ├── cache.ts                      # cache global LRU (per-instance)
│   └── types.ts
├── store/ (Zustand: connection, items, favorites, player)
├── components/ (Login, Home, Grid, Player, Modals, Search…)
├── e2e/ (mock-server.mjs, audit.mjs, real-check.mjs — portados)
└── vercel.json
```

## Rotas da API (mesmos contratos do server.py, adaptados p/ paginação)

- `POST /api/connect` `{mode:'xtream',server,username,password} | {mode:'m3u',url}`
  → `{ok, categories:{live[],vod[],series[]}, first:{live,vod,series}, counts, meta:{mode,server,url,panel,expires}}`
- `GET /api/items?conn=<hash>&type=live|vod|series&cat=<name|all>&page=0`
  → `{items:[...], page, hasMore, total}` — página de 80 itens
- `GET /api/vod?server&username&password&vod_id` → `{ok, info:{name,cover,plot,rating,genre,year,duration,cast}}`
- `GET /api/series?server&username&password&series_id` → `{ok, info, seasons:[{season,episodes:[{id,number,title,plot,logo,url}]}]}`
- `GET /api/series-search?name&server&username&password` → `{ok, match}`
- `GET /api/epg?server&username&password&stream_id` → `{ok, epg_listings}`
- `GET /api/proxy?url=` → streaming (206/416 p/ Range, Content-Type do upstream)
- `GET /api/img?url=` → imagem (UA navegador, cache 1h)

## Estratégia de Streaming no Vercel (free)

- Funções: `export const maxDuration = 60` + `export const dynamic = 'force-dynamic'`
- Live/playlist/segmentos TS: cada segmento é uma request pequena — viável
- Live longo contínuo: o free corta ~60s → **front usa URL direta do provedor primeiro** (muitos painéis enviam CORS `*`); se falhar, proxy
- Opcional: `NEXPLAY_PROXY` apontando para um proxy externo (ex.: self-host) para streaming sem cortes

## Testes (portar do webplayer-python)

- `e2e/mock-server.mjs` — mock Xtream (96 live/80 vod/30 séries) + `get.php` estilo painel
- `e2e/audit.mjs` — 99 checks (login, home, live/vod/series, busca, favoritos, M3U, painel, responsivo, proxy Range, console limpo)
- `e2e/real-check.mjs` — verificação com provedor real via `XTREAM_*` env
- `npm run test:audit`, `npm run test:real`

## Deploy

1. `npx vercel` na raiz do `nexplay-next` (framework detectado automaticamente)
2. Env vars opcionais no dashboard: `WIKI_API`, `NEXPLAY_PROXY`
3. Limites do free documentados (duração de função, 4,5MB/resposta — paginação resolve)

## Fora de escopo (v1)
- Autenticação/backoffice, banco de dados, multi-usuário
- Player com hls.js custom (usar `<video>` nativo + playlists upstream; avaliar depois)
