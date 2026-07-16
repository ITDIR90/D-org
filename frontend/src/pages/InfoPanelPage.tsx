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

function formatClock(date: Date) {
  return date.toLocaleString('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
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
  return (
    <article className={`infopanel-card infopanel-card--${task.priority}${task.is_overdue ? ' infopanel-card--overdue' : ''}`}>
      <div className="infopanel-card-top">
        <span className="infopanel-card-number">№{task.number}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="infopanel-card-title">{task.title}</p>
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
      <button type="button" className="infopanel-back-btn" onClick={goBack} title="Назад">
        ← Назад
      </button>
      <header className="infopanel-header">
        <div className="infopanel-brand">
          <LogoMark size={44} variant="light" animated />
          <div>
            <LogoText variant="short" />
            <p className="infopanel-subtitle">Задачи группы ИТ</p>
          </div>
        </div>
        <div className="infopanel-clock">{formatClock(now)}</div>
        <div className="infopanel-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => load()}>
            Обновить
          </button>
        </div>
      </header>

      <section className="infopanel-stats">
        <div className="infopanel-stat"><strong>{stats.total}</strong><span>активных</span></div>
        <div className="infopanel-stat"><strong>{stats.new}</strong><span>новые</span></div>
        <div className="infopanel-stat"><strong>{stats.inProgress}</strong><span>в работе</span></div>
        <div className="infopanel-stat infopanel-stat--warn"><strong>{stats.overdue}</strong><span>просрочено</span></div>
        <div className="infopanel-stat"><strong>{stats.waiting}</strong><span>на подтверждении</span></div>
      </section>

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

      <footer className="infopanel-footer">
        Автообновление каждые {REFRESH_MS / 1000} сек
        {updatedAt && ` · обновлено ${updatedAt.toLocaleTimeString('ru-RU')}`}
      </footer>
    </div>
  );
}
