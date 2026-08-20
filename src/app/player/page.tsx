import type { Metadata } from 'next';
import { Player } from '@/components/Player';

export const metadata: Metadata = { title: 'Player | SafiraPlay' };

export default function PlayerPage() {
  return <Player />;
}