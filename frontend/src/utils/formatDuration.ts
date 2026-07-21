export function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours < 24) return `${hours.toFixed(1)} ч`;
  return `${(hours / 24).toFixed(1)} дн.`;
}

export function onTimeColor(percent: number | null): string {
  if (percent == null) return 'var(--color-grey)';
  if (percent >= 85) return 'var(--color-success-text)';
  if (percent >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function onTimeBarBg(percent: number | null): string {
  if (percent == null) return 'var(--color-grey-light)';
  if (percent >= 85) return 'var(--color-success)';
  if (percent >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function shortName(fullName: string, max = 22): string {
  if (fullName.length <= max) return fullName;
  return `${fullName.slice(0, max - 1)}…`;
}
