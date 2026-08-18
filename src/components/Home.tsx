'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemType } from '@/lib/types';
import { normName } from '@/lib/utils';
import { loadFavorites, PAGE_SIZE, useApp } from '@/store/useAppStore';
import { Card } from './Card';

const TYPE_TABS: { type: ItemType; label: string }[] = [
  { type: 'live', label: 'Canais' },
  { type: 'vod', label: 'Filmes' },
  { type: 'series', label: 'Séries' },
];

export function Home() {
  const {
    meta, counts, cats, type, cat, pages, loading, error,
    search, setType, setCat, load, setSearch, logout, favorites,
  } = useApp();
  const [showFavs, setShowFavs] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = `${type}|${cat}`;
    if (!pages[k] || pages[k].items.length === 0) load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cat]);

  useEffect(() => {
    if (!showFavs) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setShowFavs(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showFavs]);

  const current = pages[`${type}|${cat}`];
  const items = useMemo(() => {
    const list = current?.items || [];
    if (!search.trim()) return list;
    const q = normName(search);
    return list.filter((i) => normName(i.name).includes(q));
  }, [current, search]);

  const filteredTotal = current && !search ? current.total : items.length;

  const scrollTop = () => gridRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4">
      <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-xl font-black tracking-tight text-transparent">
            NexPlay
          </h1>

          <nav className="flex flex-1 gap-1 overflow-x-auto text-sm font-medium">
            {TYPE_TABS.map(({ type: t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`shrink-0 rounded-full px-4 py-1.5 transition ${
                  type === t ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {label} {counts[t] > 0 && <span className="opacity-60">({counts[t].toLocaleString('pt-BR')})</span>}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="hidden w-40 rounded-lg bg-zinc-800/80 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 sm:block"
            />
            <button
              type="button"
              onClick={() => {
                setShowFavs(!showFavs);
                useApp.setState({ favorites: loadFavorites() });
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                showFavs ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              ★ Favoritos
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-red-900/50 hover:text-red-300"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setCat('all')}
            className={`shrink-0 rounded-full px-3 py-1 transition ${
              cat === 'all' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todas ({counts[type].toLocaleString('pt-BR')})
          </button>
          {cats[type].map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setCat(c.name)}
              className={`shrink-0 rounded-full px-3 py-1 transition ${
                cat === c.name ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {c.name} ({c.count.toLocaleString('pt-BR')})
            </button>
          ))}
        </div>
      </header>

      <main ref={gridRef}>
        {error && <p className="mb-4 rounded-lg bg-red-950/60 px-4 py-2 text-sm text-red-300">{error}</p>}

        {items.length === 0 && !loading ? (
          <p className="py-20 text-center text-sm text-zinc-500">
            {search ? 'Nada encontrado nesta busca.' : 'Nenhum item nesta categoria.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {items.map((i) => (
                <Card key={i.id} item={i} />
              ))}
            </div>

            {loading && <p className="py-6 text-center text-sm text-zinc-500">Carregando…</p>}

            {current && !search && current.hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    load((current.page || 0) + 1).then(scrollTop);
                  }}
                  className="rounded-full bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-violet-600 hover:text-white disabled:opacity-50"
                >
                  Carregar mais ({filteredTotal.toLocaleString('pt-BR')} no total)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {showFavs && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4" onClick={() => setShowFavs(false)}>
          <div
            className="mx-auto mt-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-900 p-4 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-bold text-white">Favoritos ({favorites.length})</h2>
            {favorites.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Toque na estrela de um item para favoritar.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {favorites.map((i) => (
                  <Card key={i.id} item={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-zinc-600">
        {meta?.mode === 'm3u' ? meta.url : `${meta?.server} · ${meta?.username}`}
      </p>
    </div>
  );
}

export { PAGE_SIZE };