import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, createProject } from '../api/projects';
import type { Project } from '../api/projects';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge/PriorityBadge';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';
import { useAuth } from '../auth/AuthContext';
import { listGroups } from '../api/groups';
import { showAiNotice } from '../api/client';

const PROJECT_STATUS_ORDER: Record<string, number> = { new: 1, in_progress: 2, done: 3, cancelled: 4 };
const PROJECT_PRIORITY_ORDER: Record<string, number> = { medium: 1, high: 2, ferrari: 3 };

const PROJECT_SORT_ACCESSORS = {
  title: (p: Project) => p.title,
  status: (p: Project) => PROJECT_STATUS_ORDER[p.status] ?? 99,
  priority: (p: Project) => PROJECT_PRIORITY_ORDER[p.priority] ?? 99,
  author: (p: Project) => p.author_name ?? '',
  due_at: (p: Project) => (p.due_at ? new Date(p.due_at).getTime() : 0),
};

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ title: '', description: '', group_id: '', priority: 'medium' });

  const canCreate = user?.role === 'superadmin' || user?.role === 'group_admin';

  const load = () => listProjects().then(setProjects).catch(() => {});
  useEffect(() => { load(); listGroups().then(setGroups).catch(() => {}); }, []);
  const accessors = useMemo(() => PROJECT_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(projects, accessors);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createProject({
      title: form.title,
      description: form.description || undefined,
      group_id: Number(form.group_id),
      priority: form.priority,
    });
    showAiNotice(res.ai_corrected);
    setShowCreate(false);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Проекты</h1>
        {canCreate && <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>Создать проект</button>}
      </div>
      {showCreate && (
        <div className="card" style={{ maxWidth: 500, marginBottom: '1rem' }}>
          <form onSubmit={handleCreate}>
            <div className="form-group"><label>Название</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="form-group"><label>Описание</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-group">
              <label>Группа</label>
              <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} required>
                <option value="">Выберите</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Создать</button>
          </form>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Название" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Статус" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Важность" sortKey="priority" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Автор" sortKey="author" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Срок" sortKey="due_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/projects/${p.id}`}>{p.title}</Link></td>
                <td><StatusBadge status={p.status} /></td>
                <td><PriorityBadge priority={p.priority} /></td>
                <td>{p.author_name}</td>
                <td>{p.due_at ? new Date(p.due_at).toLocaleDateString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
