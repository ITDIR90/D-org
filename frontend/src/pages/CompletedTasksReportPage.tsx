import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  exportCompletedTasksXlsx,
  getCompletedTasksReport,
  type CompletedTaskReportRow,
  type CompletedTasksParams,
  type CompletedTasksReport,
} from '../api/reports';
import { listGroups } from '../api/groups';
import { listCategories, type Category } from '../api/categories';
import { listUsers } from '../api/users';
import type { User as ApiUser } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../constants/roles';
import { Modal } from '../components/Modal/Modal';

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const PERIOD_PRESETS = [
  { key: 'today', label: 'Сегодня', days: 0 },
  { key: '7', label: '7 дней', days: 7 },
  { key: '30', label: '30 дней', days: 30 },
  { key: '90', label: '90 дней', days: 90 },
  { key: 'custom', label: 'Произвольный', days: -1 },
];

function fmtDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtFullDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  const months = [
    'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.replace('Z', '+00:00'));
  if (Number.isNaN(d.getTime())) return iso;
  return (
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  );
}

const PRIORITY_RU: Record<string, string> = {
  medium: 'Средний',
  high: 'Высокий',
  ferrari: 'Феррари',
};

interface CellSelection {
  rowId: number;
  rowName: string;
  day: string;
  taskIds: number[];
}

export function CompletedTasksReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.SUPERADMIN || user?.role === ROLES.GROUP_ADMIN;
  const isSuper = user?.role === ROLES.SUPERADMIN;

  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState('30');
  const [dateFrom, setDateFrom] = useState(() => toISO(addDays(today, -29)));
  const [dateTo, setDateTo] = useState(() => toISO(today));

  const [groupId, setGroupId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [groupBy, setGroupBy] = useState<'category' | 'user'>('category');

  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [report, setReport] = useState<CompletedTasksReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selection, setSelection] = useState<CellSelection | null>(null);

  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});
    listUsers().then(setUsers).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  const applyPreset = (key: string) => {
    setPreset(key);
    if (key === 'custom') return;
    const days = Number(key);
    const to = new Date();
    const from = addDays(to, -(days - 1));
    setDateFrom(toISO(from));
    setDateTo(toISO(to));
  };

  const buildParams = useCallback((): CompletedTasksParams => ({
    date_from: dateFrom,
    date_to: dateTo,
    group_id: groupId === '' ? undefined : groupId,
    user_id: userId === '' ? undefined : userId,
    category_id: categoryId === '' ? undefined : categoryId,
    group_by: groupBy,
  }), [dateFrom, dateTo, groupId, userId, categoryId, groupBy]);

  const load = useCallback((params: CompletedTasksParams) => {
    setLoading(true);
    setError(null);
    getCompletedTasksReport(params)
      .then(setReport)
      .catch((e) => {
        setReport(null);
        setError(e?.message || 'Не удалось загрузить отчёт');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load(buildParams());
  }, [isAdmin, load, buildParams]);

  const selectedTasks = useMemo(() => {
    if (!selection || !report) return [];
    const byId = new Map(report.tasks.map((t) => [t.task_id, t]));
    return selection.taskIds
      .map((id) => byId.get(id))
      .filter((t): t is CompletedTaskReportRow => Boolean(t));
  }, [selection, report]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const rowsTotal = report?.rows.reduce((sum, c) => sum + c.total, 0) ?? 0;
  const daysCount = report?.days.length ?? 0;
  const lastDay = report?.days[daysCount - 1];

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCompletedTasksXlsx(buildParams());
    } catch (e: any) {
      setError(e?.message || 'Не удалось выгрузить в Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Выполненные задачи</h1>
        <div className="header-actions">
          <Link to="/reports" className="btn btn-secondary">← Отчёты</Link>
          <button
            type="button"
            className="btn btn-primary"
            disabled={exporting || !report || report.total === 0}
            onClick={handleExport}
          >
            {exporting ? 'Выгрузка...' : '⬇ Выгрузить в Excel'}
          </button>
        </div>
      </div>
      <p className="page-hint">
        Матрица выполненных задач: колонки — дни периода, строки — категории или сотрудники (выбирается ниже). Нажмите на ячейку, чтобы увидеть список задач.
      </p>

      <div className="report-filters">
        <label>
          Строки
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value === 'user' ? 'user' : 'category')}>
            <option value="category">Категории</option>
            <option value="user">Сотрудники</option>
          </select>
        </label>

        <label>
          Период
          <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
            {PERIOD_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>

        <label>
          С даты
          <input type="date" value={dateFrom} onChange={(e) => { setPreset('custom'); setDateFrom(e.target.value); }} />
        </label>
        <label>
          По дату
          <input type="date" value={dateTo} onChange={(e) => { setPreset('custom'); setDateTo(e.target.value); }} />
        </label>

        {isSuper && (
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

        <label>
          Сотрудник
          <select value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Все сотрудники</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </label>

        <label>
          Категория
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="report-summary">
        Выполнено за период: <strong>{report?.total ?? 0}</strong> задач
        {daysCount > 0 && <> в {daysCount} дн.</>}
        {lastDay && <> · по {fmtFullDay(lastDay)}</>}
      </div>

      {error && <p className="empty" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {loading ? (
        <p className="empty">Загрузка отчёта...</p>
      ) : !report || report.total === 0 ? (
        <p className="empty">Нет выполненных задач за выбранный период</p>
      ) : (
        <div className="table-card">
          <div className="table-wrap wide">
            <table className="data-table matrix-table">
              <thead>
                <tr>
                  <th className="matrix-corner">{groupBy === 'user' ? 'Сотрудник / День' : 'Категория / День'}</th>
                  {report.days.map((day) => (
                    <th key={day} className="matrix-day">
                      {fmtDay(day)}
                      <span className="matrix-weekday">{fmtWeekday(day)}</span>
                    </th>
                  ))}
                  <th className="matrix-total">Итого</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.row_id}>
                    <td className="matrix-cat">{row.row_name}</td>
                    {row.cells.map((cell) => (
                      <td key={cell.day} className="matrix-cell-wrap">
                        {cell.count > 0 ? (
                          <button
                            type="button"
                            className="matrix-cell"
                            onClick={() => setSelection({ rowId: row.row_id, rowName: row.row_name, day: cell.day, taskIds: cell.task_ids })}
                          >
                            {cell.count}
                          </button>
                        ) : (
                          <span className="matrix-cell-empty">·</span>
                        )}
                      </td>
                    ))}
                    <td className="matrix-total"><strong>{row.total}</strong></td>
                  </tr>
                ))}
                <tr className="matrix-total-row">
                  <td className="matrix-cat"><strong>Итого по дням</strong></td>
                  {report.day_totals.map((t, i) => (
                    <td key={report.days[i]} className="matrix-total">
                      {t > 0 ? <strong>{t}</strong> : <span className="text-muted">·</span>}
                    </td>
                  ))}
                  <td className="matrix-total"><strong>{rowsTotal}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={selection !== null}
        onClose={() => setSelection(null)}
        title={selection ? `${selection.rowName} · ${fmtFullDay(selection.day)} · ${selectedTasks.length} зад.` : ''}
      >
        {selectedTasks.length === 0 ? (
          <p className="empty">Задачи не найдены</p>
        ) : (
          <div className="cell-tasks">
            {selectedTasks.map((t) => (
              <div key={t.task_id} className="cell-task">
                <div className="cell-task-head">
                  <Link to={`/tasks/${t.task_id}`}>#{t.number}</Link>
                  <span className="cell-task-priority">{PRIORITY_RU[t.priority || ''] || t.priority || ''}</span>
                </div>
                <div className="cell-task-title">{t.title}</div>
                <div className="cell-task-meta">
                  {t.assignee_name} · {t.category_name} · {fmtTime(t.completed_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function fmtWeekday(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return weekdays[d.getDay()];
}