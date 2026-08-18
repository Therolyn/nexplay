'use client';

import { useState } from 'react';
import type { Episode, Item, Season, SeriesInfo } from '@/lib/types';
import { useApp } from '@/store/useAppStore';
import { InfoRow, ModalShell, plotFallback, useDetail, useFavorite, usePlayback } from './Modal';

interface SeriesData {
  info: SeriesInfo;
  seasons: Season[];
}

export function SeriesModal({ item }: { item: Item }) {
  const { conn, meta, closeModal } = useApp();
  const play = usePlayback();
  const { fav, toggleFavorite } = useFavorite(item);
  const [openSeason, setOpenSeason] = useState(0);

  const { data, loading, error } = useDetail<SeriesData | null>(async () => {
    if (!conn) return null;
    const params = new URLSearchParams({ conn });
    if (meta?.mode === 'xtream') {
      params.set('series_id', item.id.slice(1));
    } else {
      const search = await fetch(`/api/series-search?conn=${encodeURIComponent(conn)}&name=${encodeURIComponent(item.name)}`);
      const sj = (await search.json()) as { ok: boolean; match?: { series_id?: string } | null; error?: string };
      if (!sj.ok) throw new Error(String(sj.error || 'Falha na busca da série'));
      const sid = sj.match?.series_id;
      if (!sid) throw new Error('Série não encontrada no painel do provedor. A lista M3U pode não ter as informações completas.');
      params.set('series_id', sid);
    }
    const res = await fetch(`/api/series?${params.toString()}`);
    const j = (await res.json()) as { ok: boolean; info?: SeriesInfo; seasons?: Season[]; error?: string };
    if (!j.ok) throw new Error(String(j.error || 'Falha ao carregar detalhes'));
    return { info: j.info!, seasons: j.seasons || [] };
  });

  const info = data?.info;
  const seasons = data?.seasons || [];
  const name = info?.name || item.name;
  const plot = plotFallback(info?.plot || item.plot || '');
  const effectiveOpen = seasons.length ? Math.min(openSeason, seasons.length - 1) : 0;

  const playEpisode = (ep: Episode) => {
    closeModal();
    play(ep.url, `${name} — ${ep.season ? `T${ep.season} ` : ''}${ep.number ? `E${ep.number} ` : ''}${ep.title}`);
  };

  return (
    <ModalShell onClose={closeModal}>
      <div className="relative">
        {info?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.cover} alt={name} className="h-56 w-full object-cover sm:h-72" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-fuchsia-900/40 to-zinc-900" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-zinc-200 hover:bg-black/80"
        >
          ✕
        </button>
      </div>

      <div className="p-5 pt-2">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-white">{name}</h2>
          <button
            type="button"
            onClick={() => toggleFavorite(item)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${fav ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'}`}
          >
            {fav ? '★ Favorito' : '☆ Favoritar'}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <InfoRow label="Ano" value={info?.year || item.year || ''} />
          <InfoRow label="Nota" value={info?.rating || item.rating || ''} />
          <InfoRow label="Gênero" value={info?.genre || item.genre || ''} />
        </div>
        {info?.cast ? <InfoRow label="Elenco" value={info.cast} /> : item.cast ? <InfoRow label="Elenco" value={item.cast} /> : null}

        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{plot}</p>

        {loading && <p className="mt-3 text-sm text-zinc-500">Carregando detalhes…</p>}
        {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

        {!error && seasons.length > 0 && (
          <div className="mt-5 space-y-2">
            {seasons.map((s, si) => {
              const open = effectiveOpen === si;
              return (
                <div key={s.season} className="overflow-hidden rounded-xl bg-zinc-800/60 ring-1 ring-white/5">
                  <button
                    type="button"
                    onClick={() => setOpenSeason(open ? -1 : si)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:text-white"
                  >
                    <span>Temporada {s.season}</span>
                    <span className="text-xs text-zinc-500">{s.episodes.length} episódios {open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <ul className="border-t border-white/5">
                      {s.episodes.map((ep) => (
                        <li key={ep.id}>
                          <button
                            type="button"
                            onClick={() => playEpisode(ep)}
                            className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-700/40 hover:text-white"
                          >
                            <span className="shrink-0 font-mono text-xs text-zinc-500">E{ep.number}</span>
                            <span className="min-w-0">
                              <span className="block truncate">{ep.title}</span>
                              {ep.plot && <span className="mt-0.5 block line-clamp-1 text-xs text-zinc-500">{ep.plot}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!error && !loading && seasons.length === 0 && (
          <button
            type="button"
            disabled={!item.url}
            onClick={() => {
              closeModal();
              play(item.url, name);
            }}
            className="mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:opacity-50"
          >
            ▶ Assistir
          </button>
        )}
      </div>
    </ModalShell>
  );
}