import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal/Modal';
import { listRecurring } from '../api/chats';
import { listGroups } from '../api/groups';
import { listCategories } from '../api/categories';
import { listUsers } from '../api/users';
import type { User as ApiUser } from '../api/auth';
import { api, showAiNotice } from '../api/client';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';

type RecurringRow = Record<string, unknown>;

const SCHEDULE_ORDER: Record<string, number> = { daily: 1, weekly: 2, monthly: 3, cron: 4 };

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const RECURRING_SORT_ACCESSORS = {
  title: (item: RecurringRow) => (item.title as string) || '',
  schedule_type: (item: RecurringRow) => SCHEDULE_ORDER[item.schedule_type as string] ?? 99,
  is_active: (item: RecurringRow) => (item.is_active ? 1 : 0),
  last_run_at: (item: RecurringRow) => (item.last_run_at ? new Date(item.last_run_at as string).getTime() : 0),
  next_run_at: (item: RecurringRow) => (item.next_run_at ? new Date(item.next_run_at as string).getTime() : 0),
};

interface FormState {
  title: string;
  description: string;
  target_group_id: string;
  category_id: string;
  default_assignee_id: string;
  schedule_type: string;
  interval: number;
  weekdays: number[];
  month_days: number[];
  run_at: string;
  cron_expression: string;
  start_date: string;
  end_date: string;
  due_days: number;
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  target_group_id: '',
  category_id: '',
  default_assignee_id: '',
  schedule_type: 'daily',
  interval: 1,
  weekdays: [],
  month_days: [],
  run_at: '09:00',
  cron_expression: '',
  start_date: '',
  end_date: '',
  due_days: 2,
};

function scheduleLabel(row: RecurringRow): string {
  const type = row.schedule_type as string;
  const runAt = (row.run_at as string) || '';
  const interval = (row.interval as number) || 1;
  const time = runAt ? ` в ${runAt}` : '';
  if (type === 'cron') return `Cron: ${(row.cron_expression as string) || '—'}`;
  if (type === 'daily') {
    return interval === 1 ? `Ежедневно${time}` : `Каждые ${interval} дн.${time}`;
  }
  if (type === 'weekly') {
    const wd = (row.weekdays as number[] | null) || [];
    const days = wd.length ? wd.sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join(', ') : '—';
    const freq = interval === 1 ? 'Еженедельно' : `Каждые ${interval} нед.`;
    return `${freq}${time} (${days})`;
  }
  if (type === 'monthly') {
    const md = (row.month_days as number[] | null) || [];
    const days = md.length ? md.slice().sort((a, b) => a - b).join(', ') : '—';
    const freq = interval === 1 ? 'Ежемесячно' : `Каждые ${interval} мес.`;
    return `${freq}${time} (числа: ${days})`;
  }
  return String(type);
}

function periodLabel(row: RecurringRow): string {
  const start = row.start_date as string | null;
  const end = row.end_date as string | null;
  if (!start && !end) return 'Без периода';
  return `${start || '—'} — ${end || '—'}`;
}

export function RecurringTasksPage() {
  const [items, setItems] = useState<RecurringRow[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; group_id: number }[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listRecurring().then(setItems).catch(() => {});
  useEffect(() => { load(); listGroups().then(setGroups).catch(() => {}); listCategories().then(setCategories).catch(() => {}); listUsers().then(setUsers).catch(() => {}); }, []);

  const accessors = useMemo(() => RECURRING_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(items, accessors);

  const isEditing = editingId !== null;
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.full_name])), [users]);
  const usersInGroup = useMemo(() => {
    const gid = Number(form.target_group_id);
    if (!gid) return users.filter((u) => u.is_active);
    return users.filter((u) => u.is_active && u.member_group_ids.includes(gid));
  }, [users, form.target_group_id]);

  const buildPayload = (f: FormState): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      title: f.title,
      schedule_type: f.schedule_type,
      interval: f.interval,
      due_days: f.due_days,
    };
    if (f.description) payload.description = f.description;
    if (f.default_assignee_id) payload.default_assignee_id = Number(f.default_assignee_id);
    if (f.run_at) payload.run_at = f.run_at;
    if (f.start_date) payload.start_date = f.start_date;
    if (f.end_date) payload.end_date = f.end_date;
    if (f.schedule_type === 'cron') payload.cron_expression = f.cron_expression;
    if (f.schedule_type === 'weekly') payload.weekdays = f.weekdays;
    if (f.schedule_type === 'monthly') payload.month_days = f.month_days;
    return payload;
  };

  const fillForm = (row: RecurringRow) => {
    setForm({
      title: (row.title as string) || '',
      description: (row.description as string) || '',
      target_group_id: row.target_group_id != null ? String(row.target_group_id) : '',
      category_id: row.category_id != null ? String(row.category_id) : '',
      default_assignee_id: row.default_assignee_id != null ? String(row.default_assignee_id) : '',
      schedule_type: (row.schedule_type as string) || 'daily',
      interval: (row.interval as number) || 1,
      weekdays: Array.isArray(row.weekdays) ? (row.weekdays as number[]) : [],
      month_days: Array.isArray(row.month_days) ? (row.month_days as number[]) : [],
      run_at: (row.run_at as string) || '09:00',
      cron_expression: (row.cron_expression as string) || '',
      start_date: (row.start_date as string) || '',
      end_date: (row.end_date as string) || '',
      due_days: (row.due_days as number) != null ? (row.due_days as number) : 2,
    });
  };

  const openEdit = (row: RecurringRow) => {
    fillForm(row);
    setEditingId(row.id as number);
    setError(null);
  };

  const toggleWeekday = (d: number) => {
    const wd = form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d];
    setForm({ ...form, weekdays: wd });
  };

  const setMonthDays = (value: string) => {
    const md = value
      .split(/[,\s]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);
    setForm({ ...form, month_days: md });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload: Record<string, unknown> = {
      title: form.title,
      target_group_id: Number(form.target_group_id),
      category_id: Number(form.category_id),
      schedule_type: form.schedule_type,
      interval: form.interval,
      due_days: form.due_days,
    };
    if (form.description) payload.description = form.description;
    if (form.default_assignee_id) payload.default_assignee_id = Number(form.default_assignee_id);
    if (form.run_at) payload.run_at = form.run_at;
    if (form.start_date) payload.start_date = form.start_date;
    if (form.end_date) payload.end_date = form.end_date;
    if (form.schedule_type === 'cron') payload.cron_expression = form.cron_expression;
    if (form.schedule_type === 'weekly') payload.weekdays = form.weekdays;
    if (form.schedule_type === 'monthly') payload.month_days = form.month_days;
    try {
      const res = await api<{ message: string; ai_corrected: boolean }>('/api/v1/recurring-tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showAiNotice(res.ai_corrected);
      setForm(INITIAL_FORM);
      load();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Не удалось создать шаблон');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    setError(null);
    setBusy(true);
    try {
      await api<Record<string, unknown>>(`/api/v1/recurring-tasks/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload(form)),
      });
      setEditingId(null);
      setForm(INITIAL_FORM);
      load();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Не удалось сохранить шаблон');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: RecurringRow) => {
    const id = row.id as number;
    const action = row.is_active ? 'deactivate' : 'activate';
    try {
      await api<Record<string, unknown>>(`/api/v1/recurring-tasks/${id}/${action}`, { method: 'POST' });
      load();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Не удалось изменить активность');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Регулярные задачи</h1></div>
      <div className="card" style={{ maxWidth: 620, marginBottom: '1rem' }}>
        <h2>Новый шаблон</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Название</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label>Группа</label>
            <select value={form.target_group_id} onChange={(e) => setForm({ ...form, target_group_id: e.target.value })} required>
              <option value="">Выберите</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Категория</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
              <option value="">Выберите</option>
              {categories.filter((c) => !form.target_group_id || c.group_id === Number(form.target_group_id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ответственный (по умолчанию)</label>
            <select value={form.default_assignee_id} onChange={(e) => setForm({ ...form, default_assignee_id: e.target.value })}>
              <option value="">Не назначен</option>
              {usersInGroup.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Срок действия</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} title="Дата начала" />
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} title="Дата окончания" />
            </div>
            <div className="form-hint">Пустые поля означают бессрочное действие. Дата начала/окончания — период, в котором шаблон создаёт задачи.</div>
          </div>

          <div className="form-group">
            <label>Расписание</label>
            <select value={form.schedule_type} onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
              <option value="cron">Cron (расширенное)</option>
            </select>
          </div>

          {form.schedule_type !== 'cron' && (
            <>
              <div className="form-group">
                <label>Повторять каждые</label>
                <select value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} {form.schedule_type === 'daily' ? 'дн.' : form.schedule_type === 'weekly' ? 'нед.' : 'мес.'}
                    </option>
                  ))}
                </select>
              </div>

              {form.schedule_type === 'weekly' && (
                <div className="form-group">
                  <label>Дни недели</label>
                  <div className="weekday-picker">
                    {WEEKDAY_NAMES.map((name, idx) => (
                      <label key={idx} className="weekday-option">
                        <input type="checkbox" checked={form.weekdays.includes(idx)} onChange={() => toggleWeekday(idx)} />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.schedule_type === 'monthly' && (
                <div className="form-group">
                  <label>Числа месяца (через запятую, 1–31)</label>
                  <input value={form.month_days.join(', ')} onChange={(e) => setMonthDays(e.target.value)} placeholder="1, 15, 20" />
                </div>
              )}

              <div className="form-group">
                <label>Время запуска</label>
                <input type="time" value={form.run_at} onChange={(e) => setForm({ ...form, run_at: e.target.value })} />
              </div>
            </>
          )}

          {form.schedule_type === 'cron' && (
            <div className="form-group">
              <label>Cron-выражение</label>
              <input value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} placeholder="0 6 * * *" />
              <div className="form-hint">Формат: минуты часы день месяц день_недели (например «0 6 * * *» — ежедневно в 06:00).</div>
            </div>
          )}

          <div className="form-group">
            <label>Срок выполнения (рабочих дней)</label>
            <input type="number" min={0} max={365} value={form.due_days} onChange={(e) => setForm({ ...form, due_days: Number(e.target.value) })} />
          </div>

          {error && <p className="empty" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <button type="submit" className="btn btn-primary">Создать шаблон</button>
        </form>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Название" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Расписание</th>
              <th>Срок действия</th>
              <SortableTh label="Активен" sortKey="is_active" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Последний запуск" sortKey="last_run_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Следующий запуск" sortKey="next_run_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id as number}>
                <td>
                  <div>{item.title as string}</div>
                  {item.description ? <div className="muted">{item.description as string}</div> : null}
                  {item.default_assignee_id != null ? (
                    <div className="muted">Ответственный: {usersById.get(item.default_assignee_id as number) || `#${item.default_assignee_id}`}</div>
                  ) : null}
                </td>
                <td>{scheduleLabel(item)}</td>
                <td className="muted">{periodLabel(item)}</td>
                <td>{item.is_active ? 'Да' : 'Нет'}</td>
                <td>{item.last_run_at ? new Date(item.last_run_at as string).toLocaleString('ru-RU') : '—'}</td>
                <td>{item.next_run_at ? new Date(item.next_run_at as string).toLocaleString('ru-RU') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>Изменить</button>
                    <button
                      type="button"
                      className={item.is_active ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                      onClick={() => toggleActive(item)}
                    >
                      {item.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={isEditing} onClose={() => { setEditingId(null); setError(null); }} title="Редактирование шаблона">
        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label>Название</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label>Группа</label>
            <span className="muted">{groupsById.get(Number(form.target_group_id)) || '—'}</span>
          </div>

          <div className="form-group">
            <label>Ответственный (по умолчанию)</label>
            <select value={form.default_assignee_id} onChange={(e) => setForm({ ...form, default_assignee_id: e.target.value })}>
              <option value="">Не назначен</option>
              {usersInGroup.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Срок действия</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} title="Дата начала" />
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} title="Дата окончания" />
            </div>
          </div>

          <div className="form-group">
            <label>Расписание</label>
            <select value={form.schedule_type} onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
              <option value="cron">Cron (расширенное)</option>
            </select>
          </div>

          {form.schedule_type !== 'cron' && (
            <>
              <div className="form-group">
                <label>Повторять каждые</label>
                <select value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} {form.schedule_type === 'daily' ? 'дн.' : form.schedule_type === 'weekly' ? 'нед.' : 'мес.'}
                    </option>
                  ))}
                </select>
              </div>

              {form.schedule_type === 'weekly' && (
                <div className="form-group">
                  <label>Дни недели</label>
                  <div className="weekday-picker">
                    {WEEKDAY_NAMES.map((name, idx) => (
                      <label key={idx} className="weekday-option">
                        <input type="checkbox" checked={form.weekdays.includes(idx)} onChange={() => toggleWeekday(idx)} />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.schedule_type === 'monthly' && (
                <div className="form-group">
                  <label>Числа месяца (через запятую, 1–31)</label>
                  <input value={form.month_days.join(', ')} onChange={(e) => setMonthDays(e.target.value)} placeholder="1, 15, 20" />
                </div>
              )}

              <div className="form-group">
                <label>Время запуска</label>
                <input type="time" value={form.run_at} onChange={(e) => setForm({ ...form, run_at: e.target.value })} />
              </div>
            </>
          )}

          {form.schedule_type === 'cron' && (
            <div className="form-group">
              <label>Cron-выражение</label>
              <input value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} placeholder="0 6 * * *" />
            </div>
          )}

          <div className="form-group">
            <label>Срок выполнения (рабочих дней)</label>
            <input type="number" min={0} max={365} value={form.due_days} onChange={(e) => setForm({ ...form, due_days: Number(e.target.value) })} />
          </div>

          {error && <p className="empty" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить'}</button>
        </form>
      </Modal>
    </div>
  );
}
