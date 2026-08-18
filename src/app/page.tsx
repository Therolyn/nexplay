'use client';

import { useApp } from '@/store/useAppStore';
import { Login } from '@/components/Login';
import { Home } from '@/components/Home';
import { VodModal } from '@/components/VodModal';
import { SeriesModal } from '@/components/SeriesModal';
import { Player } from '@/components/Player';

export default function Page() {
  const { conn, modal, player } = useApp();

  if (!conn) return <Login />;

  return (
    <>
      <Home />
      {modal?.type === 'vod' && <VodModal item={modal} />}
      {modal?.type === 'series' && <SeriesModal item={modal} />}
      {player && <Player />}
    </>
  );
}