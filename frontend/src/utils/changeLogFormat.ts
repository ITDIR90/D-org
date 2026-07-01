const FIELD_LABELS: Record<string, string> = {
  status: 'Статус',
  assignee_id: 'Ответственный',
  priority: 'Важность',
  due_at: 'Срок',
  notify_before_minutes: 'Напоминание (мин.)',
  spent_hours: 'Затраченное время',
  completed_at: 'Дата выполнения',
  title: 'Название',
  description: 'Описание',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  waiting_author_confirmation: 'Ожидает подтверждения',
  cancelled: 'Отменена',
  done: 'Выполнена',
};

const PRIORITY_LABELS: Record<string, string> = {
  medium: 'Средняя',
  high: 'Важно',
  ferrari: 'Феррари',
};

export interface ChangeLogEntry {
  field_name: string;
  old_value?: string | null;
  new_value?: string | null;
  changed_by_name?: string | null;
}

function isEmptyValue(value?: string | null): boolean {
  return value == null || value === '' || value === 'None';
}

function extractEnumKey(value: string): string {
  if (value.includes('.')) {
    return value.split('.').pop()!.toLowerCase();
  }
  return value;
}

function formatDateValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
}

export function formatChangeValue(
  fieldName: string,
  rawValue: string | null | undefined,
  userNames: Record<number, string> = {},
): string | null {
  if (isEmptyValue(rawValue)) return null;

  const value = rawValue!;

  if (fieldName === 'assignee_id') {
    const id = Number(value);
    if (!Number.isNaN(id) && userNames[id]) return userNames[id];
    return Number.isNaN(id) ? value : `Пользователь #${id}`;
  }

  if (fieldName === 'status') {
    const key = extractEnumKey(value);
    return STATUS_LABELS[key] || value;
  }

  if (fieldName === 'priority') {
    const key = extractEnumKey(value);
    return PRIORITY_LABELS[key] || value;
  }

  if (fieldName === 'due_at' || fieldName === 'completed_at') {
    return formatDateValue(value);
  }

  if (fieldName === 'spent_hours') {
    const hours = Number(value);
    if (!Number.isNaN(hours)) return `${hours} ч`;
  }

  return value;
}

export function formatChangeLogMessage(
  log: ChangeLogEntry,
  userNames: Record<number, string> = {},
): string {
  const oldVal = formatChangeValue(log.field_name, log.old_value, userNames);
  const newVal = formatChangeValue(log.field_name, log.new_value, userNames);
  const fieldLabel = FIELD_LABELS[log.field_name] || log.field_name;

  switch (log.field_name) {
    case 'assignee_id':
      if (!oldVal && newVal) return `Назначен ответственный: ${newVal}`;
      if (oldVal && !newVal) return `Снят ответственный: ${oldVal}`;
      if (oldVal && newVal) return `Ответственный изменён: ${oldVal} → ${newVal}`;
      return 'Изменён ответственный';

    case 'status':
      if (oldVal && newVal) return `Статус изменён: ${oldVal} → ${newVal}`;
      if (newVal) return `Статус: ${newVal}`;
      return `Статус: ${oldVal}`;

    case 'priority':
      if (oldVal && newVal) return `Важность изменена: ${oldVal} → ${newVal}`;
      return `${fieldLabel}: ${newVal || oldVal}`;

    case 'due_at':
      if (oldVal && newVal) return `Срок изменён: ${oldVal} → ${newVal}`;
      return `${fieldLabel}: ${newVal || oldVal}`;

    case 'spent_hours':
      if (!oldVal && newVal) return `Указано затраченное время: ${newVal}`;
      if (oldVal && newVal) return `Затраченное время изменено: ${oldVal} → ${newVal}`;
      return `${fieldLabel}: ${newVal || oldVal}`;

    case 'completed_at':
      if (newVal) return `Задача отмечена выполненной: ${newVal}`;
      return `${fieldLabel}: ${oldVal || newVal}`;

    case 'title':
    case 'description':
      if (oldVal && newVal) return `${fieldLabel} изменено`;
      return `${fieldLabel}: ${newVal || oldVal}`;

    default:
      if (oldVal && newVal) return `${fieldLabel}: ${oldVal} → ${newVal}`;
      if (newVal) return `${fieldLabel}: ${newVal}`;
      if (oldVal) return `${fieldLabel}: ${oldVal}`;
      return `Изменено поле «${fieldLabel}»`;
  }
}

export function buildUserNameMap(
  users: { id: number; full_name: string }[],
): Record<number, string> {
  return Object.fromEntries(users.map((u) => [u.id, u.full_name]));
}
