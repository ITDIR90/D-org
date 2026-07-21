import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getEmployeeEfficiencyReport, type EmployeeEfficiencyRow } from '../api/reports';
import { listGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import { EmployeeEfficiencyChart } from '../components/Reports/EmployeeEfficiencyChart';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';
import { formatHours } from '../utils/formatDuration';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
  { value: 180, label: '180 дней' },
];

type ViewMode = 'table' | 'chart';

const SORT_ACCESSORS = {
  full_name: (r: EmployeeEfficiencyRow) => r.full_name,
  completed_count: (r: EmployeeEfficiencyRow) => r.completed_count,
  avg_completion_hours: (r: EmployeeEfficiencyRow) => r.avg_completion_hours ?? -1,
  on_time_percent: (r: EmployeeEfficiencyRow) => r.on_time_percent ?? -1,
  avg_overdue_hours: (r: EmployeeEfficiencyRow) => r.avg_overdue_hours ?? -1,
};

export function EmployeeEfficiencyPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'group_admin';
  const [periodDays, setPeriodDays] = useState(30);
  const [groupId, setGroupId] = useState<number | ''>('');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<EmployeeEfficiencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('chart');

  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    getEmployeeEfficiencyReport({
      period_days: periodDays,
      group_id: groupId === '' ? undefined : groupId,
    })
      .then((report) => setRows(report.rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [isAdmin, periodDays, groupId]);

  const accessors = useMemo(() => SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(rows, accessors, 'completed_count', 'desc');

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Эффективность сотрудников</h1>
        <div className="view-toggle" role="tablist" aria-label="Вид отчёта">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chart'}
            className={view === 'chart' ? 'active' : ''}
            onClick={() => setView('chart')}
          >
            График
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
          >
            Таблица
          </button>
        </div>
      </div>
      <p className="page-hint">
        Статистика по выполненным задачам: объём, скорость и соблюдение сроков.
      </p>

      <div className="report-filters">
        <label>
          Период
          <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {user?.role === 'superadmin' && (
          <label>
            Группа
            <select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Все группы</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <p className="empty">Загрузка отчёта...</p>
      ) : rows.length === 0 ? (
        <p className="empty">Нет выполненных задач за выбранный период</p>
      ) : view === 'chart' ? (
        <EmployeeEfficiencyChart rows={rows} periodDays={periodDays} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Сотрудник" sortKey="full_name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                <SortableTh label="Выполнено" sortKey="completed_count" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                <SortableTh label="Среднее время" sortKey="avg_completion_hours" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                <SortableTh label="В срок, %" sortKey="on_time_percent" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                <SortableTh label="Средняя просрочка" sortKey="avg_overdue_hours" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.user_id}>
                  <td>{row.full_name}</td>
                  <td>{row.completed_count}</td>
                  <td>{formatHours(row.avg_completion_hours)}</td>
                  <td>{row.on_time_percent != null ? `${row.on_time_percent}%` : '—'}</td>
                  <td>{formatHours(row.avg_overdue_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
