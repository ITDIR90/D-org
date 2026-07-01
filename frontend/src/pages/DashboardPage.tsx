import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks } from '../api/tasks';
import { listNotifications } from '../api/chats';
import type { Task } from '../api/tasks';
import { TaskCompactList } from '../components/TaskTable/TaskCompactList';
import { useAuth } from '../auth/AuthContext';
import { isRequestOnly } from '../constants/roles';
import {
  applyRequesterTaskFilter,
  countActiveRequesterTasks,
  countAwaitingRequesterTasks,
  isAwaitingConfirmationTask,
} from '../utils/taskFilters';

function dedupeTasks(tasks: Task[]) {
  const map = new Map(tasks.map((t) => [t.id, t]));
  return [...map.values()];
}

export function DashboardPage() {
  const { user } = useAuth();
  const requester = isRequestOnly(user?.role);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [newTasks, setNewTasks] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [awaiting, setAwaiting] = useState<Task[]>([]);
  const [requesterTasks, setRequesterTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<{ id: number; title: string; message: string; created_at: string }[]>([]);

  useEffect(() => {
    if (requester) {
      Promise.all([listTasks({ created_by_me: true }), listNotifications()])
        .then(([created, notifs]) => {
          setRequesterTasks(created);
          setNotifications(notifs.slice(0, 5));
        })
        .catch(() => {});
      return;
    }
    Promise.all([
      listTasks({ my_tasks: true }),
      listTasks({ my_group: true, unassigned: true }),
      listTasks({ overdue: true }),
      listTasks({ created_by_me: true }),
      listNotifications(),
    ])
      .then(([my, unassigned, overdueTasks, created, notifs]) => {
        const awaitingTasks = dedupeTasks(
          [...my, ...created].filter((t) => t.status === 'waiting_author_confirmation'),
        );
        const activeMy = my.filter(
          (t) => !['done', 'cancelled', 'waiting_author_confirmation'].includes(t.status),
        );

        setMyTasks(activeMy);
        setNewTasks(unassigned);
        setOverdue(overdueTasks);
        setAwaiting(awaitingTasks);
        setNotifications(notifs.slice(0, 5));
      })
      .catch(() => {});
  }, [requester]);

  const activeRequests = useMemo(
    () => applyRequesterTaskFilter(requesterTasks, 'active'),
    [requesterTasks],
  );
  const awaitingRequests = useMemo(
    () => requesterTasks.filter(isAwaitingConfirmationTask),
    [requesterTasks],
  );

  const awaitingToConfirm = useMemo(
    () => awaiting.filter((t) => t.author_id === user?.id),
    [awaiting, user?.id],
  );

  const awaitingWaiting = useMemo(
    () => awaiting.filter((t) => t.author_id !== user?.id),
    [awaiting, user?.id],
  );

  if (requester) {
    return (
      <div>
        <div className="page-header">
          <h1>Главная</h1>
          <Link to="/tasks/new" className="btn btn-primary">Новая заявка</Link>
        </div>
        <div className="dashboard-stats requester-stats">
          <div className="stat-card">
            <span className="stat-value">{countActiveRequesterTasks(requesterTasks)}</span>
            <span className="stat-label">В работе</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{countAwaitingRequesterTasks(requesterTasks)}</span>
            <span className="stat-label">На подтверждении</span>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="card dashboard-card">
            <h2><span className="stat-dot stat-dot--tasks" /> В работе ({activeRequests.length})</h2>
            <TaskCompactList tasks={activeRequests.slice(0, 6)} showAssignee />
            {activeRequests.length > 6 && <Link to="/tasks/my?filter=active" className="card-link">Все заявки →</Link>}
            {activeRequests.length === 0 && <p className="empty">Нет заявок в работе</p>}
          </div>
          <div className="card dashboard-card">
            <h2><span className="stat-dot stat-dot--done" /> На подтверждении ({awaitingRequests.length})</h2>
            <TaskCompactList tasks={awaitingRequests.slice(0, 6)} showAssignee />
            {awaitingRequests.length > 0 && (
              <Link to="/tasks/my?filter=awaiting_confirmation" className="card-link">Подтвердить →</Link>
            )}
            {awaitingRequests.length === 0 && <p className="empty">Нет заявок на подтверждении</p>}
          </div>
          <div className="card dashboard-card">
            <h2>Уведомления</h2>
            {notifications.length === 0 ? (
              <p className="empty">Нет уведомлений</p>
            ) : (
              <ul className="notif-list">
                {notifications.map((n) => (
                  <li key={n.id} className="notif-item">
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/notifications" className="card-link">Все уведомления →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Главная</h1>
        <Link to="/tasks/new" className="btn btn-primary">Создать задачу</Link>
      </div>
      <div className="dashboard-grid">
        <div className="card dashboard-card">
          <h2><span className="stat-dot stat-dot--tasks" /> Мои задачи ({myTasks.length})</h2>
          <TaskCompactList tasks={myTasks.slice(0, 6)} showAuthor />
          {myTasks.length > 6 && <Link to="/tasks/my" className="card-link">Показать все →</Link>}
        </div>
        <div className="card dashboard-card">
          <h2><span className="stat-dot stat-dot--waiting" /> Новые ({newTasks.length})</h2>
          <TaskCompactList tasks={newTasks.slice(0, 6)} showAuthor />
          {newTasks.length > 0 && (
            <Link to="/tasks/group?filter=unassigned" className="card-link">Показать все →</Link>
          )}
        </div>
        <div className="card dashboard-card">
          <h2><span className="stat-dot stat-dot--overdue" /> Просроченные ({overdue.length})</h2>
          <TaskCompactList tasks={overdue.slice(0, 6)} showAssignee />
        </div>
        <div className="card dashboard-card">
          <h2><span className="stat-dot stat-dot--done" /> Ожидают подтверждения ({awaiting.length})</h2>
          {awaitingToConfirm.length > 0 && (
            <>
              <p className="dashboard-card-hint">Требуют вашего подтверждения</p>
              <TaskCompactList tasks={awaitingToConfirm.slice(0, 6)} showAssignee />
            </>
          )}
          {awaitingWaiting.length > 0 && (
            <>
              <p className="dashboard-card-hint">Ожидают решения автора</p>
              <TaskCompactList tasks={awaitingWaiting.slice(0, 6)} showAuthor />
            </>
          )}
          {awaiting.length === 0 && <p className="empty">Нет задач</p>}
        </div>
        <div className="card dashboard-card">
          <h2>Последние уведомления</h2>
          {notifications.length === 0 ? (
            <p className="empty">Нет уведомлений</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => (
                <li key={n.id} className="notif-item">
                  <strong>{n.title}</strong>
                  <span>{n.message}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="card-link">Все уведомления →</Link>
        </div>
      </div>
    </div>
  );
}
