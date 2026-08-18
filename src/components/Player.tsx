'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/store/useAppStore';
import Hls from 'hls.js';

export function Player() {
  const { player, closePlayer } = useApp();
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

  if (!player) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="truncate pr-4 text-sm font-semibold text-zinc-200" title={player.title}>
          {player.title}
        </p>
        <button
          type="button"
          onClick={closePlayer}
          className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm text-zinc-200 transition hover:bg-red-900/60 hover:text-red-300"
        >
          ✕ Fechar
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-2 pb-4">
        <video ref={videoRef} autoPlay controls playsInline className="max-h-full w-full bg-black" />
      </div>

      <p className="pb-2 text-center text-xs text-zinc-600">
        {failed ? 'Direto bloqueado — reproduzindo via proxy.' : isHls ? 'Reproduzindo via HLS' : 'Reproduzindo direto'}
      </p>
    </div>
  );
}