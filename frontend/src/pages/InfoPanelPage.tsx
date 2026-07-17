import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listInfopanelTasks, type Task } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge/PriorityBadge';
import { LogoMark, LogoText } from '../components/Logo/Logo';

const REFRESH_MS = 30_000;

function formatDue(d: string) {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBarClock(date: Date) {
  return date.toLocaleString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ColumnId = 'new' | 'in_progress' | 'waiting_author_confirmation' | 'overdue';

const COLUMNS: { id: ColumnId; title: string; match: (task: Task) => boolean }[] = [
  { id: 'overdue', title: 'Просроченные', match: (t) => t.is_overdue },
  { id: 'new', title: 'Новые', match: (t) => t.status === 'new' && !t.is_overdue },
  {
    id: 'in_progress',
    title: 'В работе',
    match: (t) => t.status === 'in_progress' && !t.is_overdue,
  },
  {
    id: 'waiting_author_confirmation',
    title: 'На подтверждении',
    match: (t) => t.status === 'waiting_author_confirmation' && !t.is_overdue,
  },
];

function InfoPanelCard({ task }: { task: Task }) {
  const description = task.description?.trim();
  return (
    <article className={`infopanel-card infopanel-card--${task.priority}${task.is_overdue ? ' infopanel-card--overdue' : ''}`}>
      <div className="infopanel-card-top">
        <span className="infopanel-card-number">№{task.number}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="infopanel-card-title">{task.title}</p>
      {description ? (
        <p className="infopanel-card-description" title={description}>
          {description}
        </p>
      ) : null}
      <div className="infopanel-card-meta">
        {task.assignee_name && <span>{task.assignee_name}</span>}
        {task.category_name && <span>{task.category_name}</span>}
        <span>{formatDue(task.due_at)}</span>
        {task.is_overdue && <span className="overdue-tag overdue-tag--sm">Просрочена</span>}
      </div>
    </article>
  );
}

export function InfoPanelPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const load = useCallback(async () => {
    try {
      const data = await listInfopanelTasks();
      setTasks(data);
      setUpdatedAt(new Date());
    } catch {
      // keep previous data on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshTimer = setInterval(load, REFRESH_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
    };
  }, [load]);

  const stats = useMemo(() => ({
    total: tasks.length,
    new: tasks.filter((t) => t.status === 'new').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => t.is_overdue).length,
    waiting: tasks.filter((t) => t.status === 'waiting_author_confirmation').length,
  }), [tasks]);

  const columns = useMemo(
    () => COLUMNS.map((column) => ({
      ...column,
      tasks: tasks.filter(column.match),
    })),
    [tasks],
  );

  return (
    <div className="infopanel-page">
      {loading ? (
        <p className="infopanel-loading">Загрузка задач...</p>
      ) : tasks.length === 0 ? (
        <p className="infopanel-empty">Нет активных задач</p>
      ) : (
        <section className="infopanel-board">
          {columns.map((column) => (
            <div key={column.id} className="infopanel-column">
              <div className="infopanel-column-head">
                <h2>{column.title}</h2>
                <span className="infopanel-column-count">{column.tasks.length}</span>
              </div>
              <div className="infopanel-column-body">
                {column.tasks.length === 0 ? (
                  <p className="infopanel-column-empty">—</p>
                ) : (
                  column.tasks.map((task) => <InfoPanelCard key={task.id} task={task} />)
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="infopanel-bar">
        <button type="button" className="infopanel-bar-btn" onClick={goBack} title="Назад">
          ← Назад
        </button>
        <div className="infopanel-bar-brand">
          <LogoMark size={28} variant="light" animated />
          <LogoText variant="short" />
          <span className="infopanel-bar-subtitle">Задачи группы ИТ</span>
        </div>
        <div className="infopanel-bar-stats" aria-label="Сводка">
          <span><strong>{stats.total}</strong> активных</span>
          <span className="infopanel-bar-stat-sep" aria-hidden>·</span>
          <span><strong>{stats.new}</strong> новые</span>
          <span className="infopanel-bar-stat-sep" aria-hidden>·</span>
          <span><strong>{stats.inProgress}</strong> в работе</span>
          <span className="infopanel-bar-stat-sep" aria-hidden>·</span>
          <span className="infopanel-bar-stat--warn"><strong>{stats.overdue}</strong> просрочено</span>
          <span className="infopanel-bar-stat-sep" aria-hidden>·</span>
          <span><strong>{stats.waiting}</strong> на подтверждении</span>
        </div>
        <time className="infopanel-bar-clock" dateTime={now.toISOString()}>
          {formatBarClock(now)}
        </time>
        <button type="button" className="btn btn-secondary btn-sm infopanel-bar-refresh" onClick={() => load()}>
          Обновить
        </button>
        <p className="infopanel-bar-meta">
          Автообновление {REFRESH_MS / 1000} с
          {updatedAt && ` · ${updatedAt.toLocaleTimeString('ru-RU')}`}
        </p>
      </footer>
    </div>
  );
}
