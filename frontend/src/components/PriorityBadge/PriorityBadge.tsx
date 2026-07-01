const PRIORITY_LABELS: Record<string, string> = {
  medium: 'Средняя',
  high: 'Важно',
  ferrari: 'Феррари',
};

const PRIORITY_CLASS: Record<string, string> = {
  medium: 'priority-medium',
  high: 'priority-high',
  ferrari: 'priority-ferrari',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`badge ${PRIORITY_CLASS[priority] || ''}`}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
