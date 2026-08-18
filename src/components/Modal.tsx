'use client';

import { useEffect, useState } from 'react';
import type { Item } from '@/lib/types';
import { useApp } from '@/store/useAppStore';

interface ModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalShell({ onClose, children }: ModalShellProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="safe-bottom max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="text-sm text-zinc-400">
      <span className="font-semibold text-zinc-500">{label}: </span>
      {value}
    </p>
  );
}

export function usePlayback() {
  const { play } = useApp();
  return play;
}

export function useFavorite(item: Item) {
  const { favorites, toggleFavorite } = useApp();
  const fav = favorites.some((f) => f.id === item.id);
  return { fav, toggleFavorite };
}

export function plotFallback(plot: string): string {
  return plot.trim() ? plot : 'Sinopse não disponível.';
}

export interface DetailState {
  loading: boolean;
  error: string | null;
}

export function useDetail<T>(fetcher: () => Promise<T>): { data: T | null } & DetailState {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading, error };
}