const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  waiting_author_confirmation: 'Ожидает подтверждения',
  cancelled: 'Отменена',
  done: 'Выполнена',
};

const STATUS_CLASS: Record<string, string> = {
  new: 'badge-new',
  in_progress: 'badge-progress',
  waiting_author_confirmation: 'badge-waiting',
  cancelled: 'badge-cancelled',
  done: 'badge-done',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] || ''}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
