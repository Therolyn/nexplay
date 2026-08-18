'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/store/useAppStore';
import Hls from 'hls.js';

export function Player() {
  const { player, closePlayer } = useApp();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const triedRef = useRef(false);

  const direct = player?.url || '';
  const proxy = `/api/proxy?url=${encodeURIComponent(direct)}`;
  const failed = failedFor === direct;
  const src = failed ? proxy : direct;
  const isHls = src.split('?')[0].endsWith('.m3u8');

  useEffect(() => {
    if (!player || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;
    const native = video.canPlayType('application/vnd.apple.mpegurl');

    const fallback = () => {
      if (!triedRef.current) {
        triedRef.current = true;
        setFailedFor(direct);
      }
    };

    if (isHls && !native && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) fallback();
      });
    } else {
      video.src = src;
      video.onerror = fallback;
      video.play().catch(() => {});
    }

    return () => {
      hls?.destroy();
      hls = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [player, failed, src, isHls, direct]);

  const goBack = () => {
    closePlayer();
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  if (!player) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-4 text-center">
        <p className="text-sm text-zinc-400">Nada para reproduzir.</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="min-h-10 rounded-full bg-violet-600 px-6 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Voltar para a página inicial
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="safe-top flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-200 transition hover:bg-zinc-700"
        >
          ←
        </button>
        <p className="min-w-0 flex-1 truncate px-2 text-center text-sm font-semibold text-zinc-200" title={player.title}>
          {player.title}
        </p>
        <button
          type="button"
          onClick={goBack}
          className="min-h-10 shrink-0 rounded-full bg-zinc-800 px-4 text-sm text-zinc-200 transition hover:bg-red-900/60 hover:text-red-300"
        >
          ✕ Fechar
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        <video ref={videoRef} autoPlay controls playsInline className="h-full w-full bg-black" />
      </div>

      <div className="safe-bottom">
        <p className="pb-2 text-center text-xs text-zinc-600">
          {failed ? 'Direto bloqueado — reproduzindo via proxy.' : isHls ? 'Reproduzindo via HLS' : 'Reproduzindo direto'}
        </p>
      </div>
    </div>
  );
}