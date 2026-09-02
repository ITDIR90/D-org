import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../constants/roles';

const REPORTS = [
  {
    path: '/reports/efficiency',
    title: 'Эффективность сотрудников',
    description: 'Статистика по выполненным задачам: объём, скорость выполнения, соблюдение сроков по каждому сотруднику.',
    icon: '📊',
  },
  {
    path: '/reports/completed-tasks',
    title: 'Выполненные задачи',
    description: 'Матрица выполненных задач: строки — категории, колонки — дни, с итогами по дням и категориям. Экспорт в Excel.',
    icon: '☑',
  },
];

export function ReportsIndexPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.SUPERADMIN || user?.role === ROLES.GROUP_ADMIN;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Отчёты</h1>
      </div>
      <p className="page-hint">
        Выберите отчёт для просмотра.
      </p>

      <div className="dashboard-grid">
        {REPORTS.map((r) => (
          <Link key={r.path} to={r.path} className="card report-card">
            <h2><span className="report-card-icon">{r.icon}</span>{r.title}</h2>
            <p className="report-card-desc">{r.description}</p>
            <span className="card-link">Открыть отчёт →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}