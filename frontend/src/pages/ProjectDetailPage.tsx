import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProject, listSubtasks, createSubtask, subtaskAction } from '../api/projects';
import type { Project, Subtask } from '../api/projects';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';
import { showAiNotice } from '../api/client';

const SUBTASK_STATUS_ORDER: Record<string, number> = { new: 1, in_progress: 2, done: 3, cancelled: 4 };

const SUBTASK_SORT_ACCESSORS = {
  title: (s: Subtask) => s.title,
  status: (s: Subtask) => SUBTASK_STATUS_ORDER[s.status] ?? 99,
  assignee: (s: Subtask) => s.assignee_name ?? '',
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [title, setTitle] = useState('');

  const load = async () => {
    if (!id) return;
    setProject(await getProject(Number(id)));
    setSubtasks(await listSubtasks(Number(id)));
  };

  useEffect(() => { load().catch(() => {}); }, [id]);

  const accessors = useMemo(() => SUBTASK_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(subtasks, accessors);

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createSubtask(Number(id), { title });
    showAiNotice(res.ai_corrected);
    setTitle('');
    load();
  };

  if (!project) return <p className="loading">Загрузка...</p>;

  return (
    <div>
      <div className="page-header"><h1>{project.title}</h1></div>
      <div className="card">
        <p>{project.description}</p>
        <p style={{ marginTop: '0.5rem' }}><StatusBadge status={project.status} /></p>
      </div>
      <div className="card">
        <h2>Подзадачи</h2>
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Название" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Статус" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Исполнитель" sortKey="assignee" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{s.assignee_name || '—'}</td>
                <td>
                  {s.status === 'new' && <button className="btn btn-sm btn-secondary" onClick={() => subtaskAction(s.id, 'start').then(load)}>Начать</button>}
                  {s.status === 'in_progress' && <button className="btn btn-sm btn-primary" onClick={() => subtaskAction(s.id, 'complete').then(load)}>Выполнить</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={handleAddSubtask} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая подзадача" required style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary btn-sm">Добавить</button>
        </form>
      </div>
    </div>
  );
}
