import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listTasks } from '../../api/tasks';
import { useAuth } from '../../auth/AuthContext';
import { isRequestOnly } from '../../constants/roles';
import { TASKS_CHANGED_EVENT } from '../../utils/taskEvents';
import {
  countActiveRequesterTasks,
  countAwaitingRequesterTasks,
  countDoneRequesterTasks,
  countAwaitingConfirmationTasks,
  countInProgressTasks,
  countUrgentTasks,
  countOverdueTasks,
} from '../../utils/taskFilters';

type KpiAccent = 'progress' | 'urgent' | 'overdue' | 'new' | 'confirm' | 'done';

interface KpiItem {
  id: string;
  to: string;
  label: string;
  count: number;
  accent: KpiAccent;
}

function KpiIcon({ accent }: { accent: KpiAccent }) {
  if (accent === 'progress') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 5.5v4.25l3 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (accent === 'urgent') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M9.2 2.4 4.8 9.2H8l-.8 4.4 4.4-6.8H8.8l.4-4.4Z" fill="currentColor" />
      </svg>
    );
  }
  if (accent === 'overdue') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (accent === 'confirm') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 8.2 7.2 10l3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (accent === 'done') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 8.2 6.8 11 12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TopbarKpis() {
  const { user } = useAuth();
  const location = useLocation();
  const requester = isRequestOnly(user?.role);
  const [counts, setCounts] = useState({
    inProgress: 0,
    urgent: 0,
    overdue: 0,
    newTasks: 0,
    awaiting: 0,
    done: 0,
  });

  const refreshCounts = useCallback(() => {
    if (!user) return;

    if (requester) {
      listTasks({ created_by_me: true })
        .then((tasks) => {
          setCounts({
            inProgress: countActiveRequesterTasks(tasks),
            urgent: 0,
            overdue: countOverdueTasks(tasks),
            newTasks: 0,
            awaiting: countAwaitingRequesterTasks(tasks),
            done: countDoneRequesterTasks(tasks),
          });
        })
        .catch(() => {});
      return;
    }

    Promise.allSettled([
      listTasks({ my_tasks: true }),
      listTasks({ my_group: true, status: 'new' }),
      listTasks({ created_by_me: true }),
    ]).then((results) => {
      const myTasks = results[0].status === 'fulfilled' ? results[0].value : [];
      const newTasks = results[1].status === 'fulfilled' ? results[1].value : [];
      const createdTasks = results[2].status === 'fulfilled' ? results[2].value : [];

      setCounts({
        inProgress: countInProgressTasks(myTasks),
        urgent: countUrgentTasks(myTasks),
        overdue: countOverdueTasks(myTasks),
        newTasks: newTasks.length,
        awaiting: countAwaitingConfirmationTasks(myTasks, createdTasks),
        done: 0,
      });
    });
  }, [requester, user]);

  useEffect(() => {
    refreshCounts();
  }, [location.pathname, location.search, refreshCounts]);

  useEffect(() => {
    const onTasksChanged = () => refreshCounts();
    const onFocus = () => refreshCounts();
    window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCounts]);

  const items: KpiItem[] = requester
    ? [
        {
          id: 'active',
          to: '/tasks/my?filter=active',
          label: 'В работе',
          count: counts.inProgress,
          accent: 'progress',
        },
        {
          id: 'overdue',
          to: '/tasks/my?filter=overdue',
          label: 'Просроченные',
          count: counts.overdue,
          accent: 'overdue',
        },
        {
          id: 'awaiting_confirmation',
          to: '/tasks/my?filter=awaiting_confirmation',
          label: 'На подтверждении',
          count: counts.awaiting,
          accent: 'confirm',
        },
        {
          id: 'done',
          to: '/tasks/my?filter=done',
          label: 'Выполненные',
          count: counts.done,
          accent: 'done',
        },
      ]
    : [
        {
          id: 'in_progress',
          to: '/tasks/my?filter=in_progress',
          label: 'В работе',
          count: counts.inProgress,
          accent: 'progress',
        },
        {
          id: 'urgent',
          to: '/tasks/my?filter=urgent',
          label: 'Срочные',
          count: counts.urgent,
          accent: 'urgent',
        },
        {
          id: 'overdue',
          to: '/tasks/my?filter=overdue',
          label: 'Просроченные',
          count: counts.overdue,
          accent: 'overdue',
        },
        {
          id: 'new',
          to: '/tasks/group?filter=unassigned',
          label: 'Новые',
          count: counts.newTasks,
          accent: 'new',
        },
        {
          id: 'awaiting_confirmation',
          to: '/tasks/my?filter=awaiting_confirmation',
          label: 'На подтверждении',
          count: counts.awaiting,
          accent: 'confirm',
        },
      ];

  return (
    <nav className="topbar-kpis" aria-label="Ключевые показатели">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          className={`topbar-kpi topbar-kpi--${item.accent}`}
          title={`${item.label}: ${item.count}`}
        >
          <span className="topbar-kpi-icon">
            <KpiIcon accent={item.accent} />
          </span>
          <span className="topbar-kpi-body">
            <span className="topbar-kpi-count">{item.count}</span>
            <span className="topbar-kpi-label">{item.label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
