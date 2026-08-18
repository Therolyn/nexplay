import type { Metadata } from 'next';
import { Player } from '@/components/Player';

export const metadata: Metadata = { title: 'Player | NexPlay' };

export default function PlayerPage() {
  return <Player />;
}