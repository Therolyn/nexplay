'use client';

import { useRouter } from 'next/navigation';
import type { Item, VodInfo } from '@/lib/types';
import { useApp } from '@/store/useAppStore';
import { InfoRow, ModalShell, plotFallback, useDetail, useFavorite, usePlayback } from './Modal';

export function VodModal({ item }: { item: Item }) {
  const { conn, meta, closeModal } = useApp();
  const router = useRouter();
  const play = usePlayback();
  const { fav, toggleFavorite } = useFavorite(item);

  const vodId = meta?.mode === 'xtream' ? item.id.slice(1) : item.panelVodId || '';

  const { data, loading, error } = useDetail<{ info: VodInfo } | null>(async () => {
    if (!conn) return null;
    const params = new URLSearchParams({ conn, name: item.name });
    if (vodId) params.set('vod_id', vodId);
    const res = await fetch(`/api/vod?${params.toString()}`);
    const j = (await res.json()) as Record<string, unknown>;
    if (!j.ok) throw new Error(String(j.error || 'Falha ao carregar detalhes'));
    return j as unknown as { info: VodInfo };
  });

  const info = data?.info;
  const name = info?.name || item.name;
  const plot = plotFallback(info?.plot || item.plot || '');

  return (
    <ModalShell onClose={closeModal}>
      <div className="relative">
        {info?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.cover} alt={name} className="h-56 w-full object-cover sm:h-72" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-violet-900/40 to-zinc-900" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
        <button
          type="button"
          onClick={closeModal}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-sm text-zinc-200 hover:bg-black/80"
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
          <InfoRow label="Duração" value={info?.duration || ''} />
          <InfoRow label="Gênero" value={info?.genre || item.genre || ''} />
        </div>
        {info?.cast ? <InfoRow label="Elenco" value={info.cast} /> : item.cast ? <InfoRow label="Elenco" value={item.cast} /> : null}
        {info?.director ? <InfoRow label="Diretor" value={info.director} /> : item.director ? <InfoRow label="Diretor" value={item.director} /> : null}

        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{plot}</p>

        {loading && <p className="mt-3 text-sm text-zinc-500">Carregando detalhes…</p>}
        {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          disabled={!item.url}
          onClick={() => {
            closeModal();
            play(item.url, name);
            router.push('/player');
          }}
          className="mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:opacity-50"
        >
          ▶ Assistir
        </button>
      </div>
    </ModalShell>
  );
}