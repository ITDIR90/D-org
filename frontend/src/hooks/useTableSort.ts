import { useMemo, useState } from 'react';
import { sortItems, type SortDirection } from '../utils/tableSort';

export function useTableSort<T>(
  items: T[],
  accessors: Record<string, (item: T) => unknown>,
  defaultKey: string | null = null,
  defaultDirection: SortDirection = 'asc',
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [direction, setDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection('asc');
  };

  const sorted = useMemo(
    () => sortItems(items, sortKey, direction, accessors),
    [items, sortKey, direction, accessors],
  );

  return { sorted, sortKey, direction, toggleSort };
}
