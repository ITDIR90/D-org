import { useEffect, useMemo, useState } from 'react';
import { listRecurring } from '../api/chats';
import { listGroups } from '../api/groups';
import { listCategories } from '../api/categories';
import { api, showAiNotice } from '../api/client';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';

type RecurringRow = Record<string, unknown>;

const SCHEDULE_ORDER: Record<string, number> = { daily: 1, weekly: 2, monthly: 3, cron: 4 };

const RECURRING_SORT_ACCESSORS = {
  title: (item: RecurringRow) => (item.title as string) || '',
  schedule_type: (item: RecurringRow) => SCHEDULE_ORDER[item.schedule_type as string] ?? 99,
  is_active: (item: RecurringRow) => (item.is_active ? 1 : 0),
  next_run_at: (item: RecurringRow) => (item.next_run_at ? new Date(item.next_run_at as string).getTime() : 0),
};

export function RecurringTasksPage() {
  const [items, setItems] = useState<RecurringRow[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; group_id: number }[]>([]);
  const [form, setForm] = useState({ title: '', target_group_id: '', category_id: '', schedule_type: 'daily', due_days: 2 });

  const load = () => listRecurring().then(setItems).catch(() => {});
  useEffect(() => { load(); listGroups().then(setGroups).catch(() => {}); listCategories().then(setCategories).catch(() => {}); }, []);

  const accessors = useMemo(() => RECURRING_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(items, accessors);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api<{ message: string; ai_corrected: boolean }>('/api/v1/recurring-tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title,
        target_group_id: Number(form.target_group_id),
        category_id: Number(form.category_id),
        schedule_type: form.schedule_type,
        due_days: form.due_days,
      }),
    });
    showAiNotice(res.ai_corrected);
    load();
  };

  return (
    <div>
      <div className="page-header"><h1>Регулярные задачи</h1></div>
      <div className="card" style={{ maxWidth: 500, marginBottom: '1rem' }}>
        <h2>Новый шаблон</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group"><label>Название</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
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
            <label>Расписание</label>
            <select value={form.schedule_type} onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Создать шаблон</button>
        </form>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Название" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Расписание" sortKey="schedule_type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Активен" sortKey="is_active" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Следующий запуск" sortKey="next_run_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id as number}>
                <td>{item.title as string}</td>
                <td>{item.schedule_type as string}</td>
                <td>{item.is_active ? 'Да' : 'Нет'}</td>
                <td>{item.next_run_at ? new Date(item.next_run_at as string).toLocaleString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
