import { Link } from 'react-router-dom';
import type { Task } from '../../api/tasks';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import { PriorityBadge } from '../PriorityBadge/PriorityBadge';

function formatDue(d: string) {
  const date = new Date(d);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TaskCompactListProps {
  tasks: Task[];
  showAssignee?: boolean;
  showAuthor?: boolean;
}

export function TaskCompactList({ tasks, showAssignee, showAuthor }: TaskCompactListProps) {
  if (!tasks.length) {
    return <p className="empty">Нет задач</p>;
  }

  return (
    <ul className="task-compact-list">
      {tasks.map((t) => (
        <li key={t.id} className={`task-compact-item ${t.is_overdue ? 'task-compact-item--overdue' : ''}`}>
          <div className="task-compact-main">
            <Link to={`/tasks/${t.id}`} className="task-compact-title">
              <span className="task-compact-number">№{t.number}</span> {t.title}
            </Link>
            <div className="task-compact-badges">
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              {t.is_overdue && <span className="overdue-tag overdue-tag--sm">Просрочена</span>}
            </div>
          </div>
          <div className="task-compact-meta">
            {t.category_name && <span className="task-compact-chip">{t.category_name}</span>}
            <span className="task-compact-chip task-compact-chip--muted">до {formatDue(t.due_at)}</span>
            {showAssignee && t.assignee_name && (
              <span className="task-compact-chip">{t.assignee_name}</span>
            )}
            {showAuthor && t.author_name && (
              <span className="task-compact-chip">{t.author_name}</span>
            )}
            {t.spent_hours != null && (
              <span className="task-compact-chip task-compact-chip--muted">{t.spent_hours} ч</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
