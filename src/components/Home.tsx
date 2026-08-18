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
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
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

  const activeLabel = cat === 'all' ? 'Todas' : cat;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4">
      <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-white/5 bg-zinc-950/95 px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <h1 className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-xl font-black tracking-tight text-transparent">
            NexPlay
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="hidden w-44 rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 sm:block"
            />

            <button
              type="button"
              aria-label="Buscar"
              onClick={() => setSearchOpen(!searchOpen)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition sm:hidden ${
                searchOpen ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowFavs(!showFavs);
                useApp.setState({ favorites: loadFavorites() });
              }}
              className={`min-h-10 rounded-lg px-3 text-sm font-medium transition ${
                showFavs ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              ★ Favoritos
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-10 rounded-lg bg-zinc-800 px-3 text-sm text-zinc-300 transition hover:bg-red-900/50 hover:text-red-300"
            >
              Sair
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="mt-2 sm:hidden">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              autoFocus
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>
        )}

        <nav className="no-scrollbar -mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4">
          {TYPE_TABS.map(({ type: t, label }) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCatOpen(false);
              }}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                type === t
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {label}{' '}
              {counts[t] > 0 && (
                <span className={type === t ? 'text-violet-200/80' : 'text-zinc-600'}>
                  ({counts[t].toLocaleString('pt-BR')})
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="relative mt-2 flex items-center">
          <button
            type="button"
            onClick={() => setCatOpen(!catOpen)}
            aria-haspopup="listbox"
            aria-expanded={catOpen}
            className="flex min-h-10 items-center gap-2 rounded-full bg-zinc-800/70 px-4 text-sm font-medium text-zinc-200 ring-1 ring-white/5 transition hover:bg-zinc-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-zinc-400">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            <span className="text-zinc-500">Categorias:</span>
            <span className={cat === 'all' ? 'text-zinc-100' : 'text-violet-300'}>{activeLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 text-zinc-500 transition-transform ${catOpen ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {catOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 sm:bg-black/30"
              onClick={() => setCatOpen(false)}
              aria-hidden="true"
            />
            <div
              role="listbox"
              aria-label="Categorias"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-zinc-900 ring-1 ring-white/10 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72 sm:max-h-96 sm:rounded-xl sm:pb-0 sm:shadow-2xl"
            >
              <div className="safe-bottom sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-zinc-900/95 px-4 py-3 sm:px-3 sm:py-2">
                <div className="flex items-center gap-2">
                  <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />
                  <p className="text-sm font-semibold text-zinc-200">Categorias</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCatOpen(false)}
                  aria-label="Fechar categorias"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="pb-2">
                <button
                  type="button"
                  role="option"
                  aria-selected={cat === 'all'}
                  onClick={() => {
                    setCat('all');
                    setCatOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition sm:py-2.5 ${
                    cat === 'all' ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>Todas</span>
                  <span className={cat === 'all' ? 'text-violet-200' : 'text-zinc-500'}>
                    {' '}({counts[type].toLocaleString('pt-BR')})
                  </span>
                </button>
                {cats[type].map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    role="option"
                    aria-selected={cat === c.name}
                    onClick={() => {
                      setCat(c.name);
                      setCatOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition sm:py-2.5 ${
                      cat === c.name ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className={cat === c.name ? 'text-violet-200' : 'text-zinc-500'}>
                      {' '}({c.count.toLocaleString('pt-BR')})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
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
                  className="min-h-11 rounded-full bg-zinc-800 px-6 text-sm font-medium text-zinc-200 transition hover:bg-violet-600 hover:text-white disabled:opacity-50"
                >
                  Carregar mais ({filteredTotal.toLocaleString('pt-BR')} no total)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {showFavs && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-start sm:p-4"
          onClick={() => setShowFavs(false)}
        >
          <div
            className="safe-bottom max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl"
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