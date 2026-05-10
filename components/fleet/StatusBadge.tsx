import { ChampionRow } from '@/lib/api';

const labelByStatus: Record<ChampionRow['status'], string> = {
  GREEN:    'GREEN',
  YELLOW:   'YELLOW',
  RED:      'RED',
  SUSPECT:  'SUSPECT',
  STALE:    'STALE',
};

const classByStatus: Record<ChampionRow['status'], string> = {
  GREEN:    'badge-green',
  YELLOW:   'badge-yellow',
  RED:      'badge-red',
  SUSPECT:  'badge-yellow',
  STALE:    'badge-mute',
};

export default function StatusBadge({ status }: { status: ChampionRow['status'] }) {
  return (
    <span
      className={`badge ${classByStatus[status]}`}
      data-testid={`status-${status}`}
    >
      {labelByStatus[status]}
    </span>
  );
}
