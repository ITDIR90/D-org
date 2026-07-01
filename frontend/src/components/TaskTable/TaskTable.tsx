import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../api/tasks';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import { PriorityBadge } from '../PriorityBadge/PriorityBadge';
import { SortableTh } from '../Table/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';

const PRIORITY_ORDER: Record<string, number> = { medium: 1, high: 2, ferrari: 3 };
const STATUS_ORDER: Record<string, number> = {
  new: 1,
  in_progress: 2,
  waiting_author_confirmation: 3,
  done: 4,
  cancelled: 5,
};

const TASK_SORT_ACCESSORS = {
  title: (t: Task) => t.title,
  status: (t: Task) => STATUS_ORDER[t.status] ?? 99,
  priority: (t: Task) => PRIORITY_ORDER[t.priority] ?? 99,
  author: (t: Task) => t.author_name ?? '',
  assignee: (t: Task) => t.assignee_name ?? '',
  category: (t: Task) => t.category_name ?? '',
  due_at: (t: Task) => new Date(t.due_at).getTime(),
  spent_hours: (t: Task) => t.spent_hours ?? -1,
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const accessors = useMemo(() => TASK_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(tasks, accessors);

  if (!tasks.length) {
    return <p className="empty">Нет задач</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <SortableTh label="Название" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Статус" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Важность" sortKey="priority" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Автор" sortKey="author" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Ответственный" sortKey="assignee" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Категория" sortKey="category" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Срок" sortKey="due_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Затрачено" sortKey="spent_hours" activeKey={sortKey} direction={direction} onSort={toggleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className={t.is_overdue ? 'row-overdue' : ''}>
              <td>
                <Link to={`/tasks/${t.id}`} className="link">{t.title}</Link>
                {t.is_overdue && <span className="overdue-tag">Просрочена</span>}
              </td>
              <td><StatusBadge status={t.status} /></td>
              <td><PriorityBadge priority={t.priority} /></td>
              <td>{t.author_name || '—'}</td>
              <td>{t.assignee_name || '—'}</td>
              <td>{t.category_name || '—'}</td>
              <td>{formatDate(t.due_at)}</td>
              <td>{t.spent_hours != null ? `${t.spent_hours} ч` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
