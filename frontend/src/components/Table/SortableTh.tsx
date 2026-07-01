import type { SortDirection } from '../../utils/tableSort';

interface SortableThProps {
  label: string;
  sortKey: string;
  activeKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: SortableThProps) {
  const active = activeKey === sortKey;

  return (
    <th className={className}>
      <button
        type="button"
        className={`sortable-th ${active ? 'sortable-th--active' : ''}`}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        <span className="sortable-th-indicator" aria-hidden>
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
