'use client';

import { useState } from 'react';
import type { Item } from '@/lib/types';
import { useApp } from '@/store/useAppStore';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Card({ item }: { item: Item }) {
  const { openItem, toggleFavorite, favorites } = useApp();
  const [imgError, setImgError] = useState(false);
  const fav = favorites.some((f) => f.id === item.id);
  const rounded = item.type === 'live' ? 'rounded-full' : 'rounded-xl';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openItem(item)}
      onKeyDown={(e) => e.key === 'Enter' && openItem(item)}
      className="group cursor-pointer select-none"
    >
      <div className={`relative aspect-[2/3] w-full overflow-hidden bg-zinc-800/70 ${rounded} ring-1 ring-white/5 transition group-hover:ring-violet-500/60`}>
        {item.logo && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.logo}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition group-hover:scale-105 ${rounded}`}
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${rounded} bg-gradient-to-br from-zinc-800 to-zinc-900`}>
            <span className="text-xl font-bold text-zinc-500">{initials(item.name)}</span>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
          }}
          className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-xs opacity-0 transition group-hover:opacity-100 ${
            fav ? 'bg-violet-600 text-white' : 'bg-black/60 text-zinc-300 hover:text-white'
          }`}
          aria-label={fav ? 'Remover favorito' : 'Adicionar favorito'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>
      <p className="mt-1.5 truncate text-center text-xs text-zinc-300 group-hover:text-white" title={item.name}>
        {item.name}
      </p>
    </div>
  );
}