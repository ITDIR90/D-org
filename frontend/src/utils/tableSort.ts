export type SortDirection = 'asc' | 'desc';

function normalizeValue(value: unknown): string | number {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return String(value).toLocaleLowerCase('ru-RU');
}

export function compareValues(a: unknown, b: unknown): number {
  const left = normalizeValue(a);
  const right = normalizeValue(b);

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), 'ru-RU', { numeric: true, sensitivity: 'base' });
}

export function sortItems<T>(
  items: T[],
  sortKey: string | null,
  direction: SortDirection,
  accessors: Record<string, (item: T) => unknown>,
): T[] {
  if (!sortKey) return items;
  const getValue = accessors[sortKey];
  if (!getValue) return items;

  return [...items].sort((a, b) => {
    const cmp = compareValues(getValue(a), getValue(b));
    return direction === 'asc' ? cmp : -cmp;
  });
}
