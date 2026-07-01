import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listGroups, createGroup, updateGroup } from '../api/groups';
import { Modal } from '../components/Modal/Modal';
import { IconGear } from '../components/Icons/IconGear';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';

type GroupRow = { id: number; name: string; description?: string };

const GROUP_SORT_ACCESSORS = {
  id: (g: GroupRow) => g.id,
  name: (g: GroupRow) => g.name,
  description: (g: GroupRow) => g.description ?? '',
};

const EMPTY_FORM = { name: '', description: '' };

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editGroup, setEditGroup] = useState<GroupRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => listGroups().then(setGroups).catch(() => {});
  useEffect(() => { load(); }, []);

  const accessors = useMemo(() => GROUP_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(groups, accessors);

  const openEdit = (g: GroupRow) => {
    setEditGroup(g);
    setEditForm({ name: g.name, description: g.description || '' });
    setError('');
  };

  const closeEdit = () => {
    setEditGroup(null);
    setError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createGroup(createForm);
    setCreateForm(EMPTY_FORM);
    load();
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editGroup) return;
    setError('');
    setSaving(true);
    try {
      await updateGroup(editGroup.id, {
        name: editForm.name,
        description: editForm.description || null,
      });
      closeEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!editGroup) return;
    if (!window.confirm(`Деактивировать группу «${editGroup.name}»?`)) return;
    setSaving(true);
    try {
      await updateGroup(editGroup.id, { is_active: false });
      closeEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка деактивации');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Группы</h1></div>
      <div className="card" style={{ maxWidth: 500, marginBottom: '1rem' }}>
        <h2>Создать группу</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Название</label>
            <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Создать</button>
        </form>
      </div>
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Название" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Описание" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={g.id} className="data-table-row--clickable" onClick={() => openEdit(g)}>
                <td>{g.id}</td>
                <td>{g.name}</td>
                <td>{g.description || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={(e) => { e.stopPropagation(); openEdit(g); }}
                      title="Редактировать"
                      aria-label={`Редактировать ${g.name}`}
                    >
                      <IconGear size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editGroup} onClose={closeEdit} title={editGroup ? `Редактирование: ${editGroup.name}` : ''}>
        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label>Название</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-danger" onClick={handleDeactivate} disabled={saving}>
              Деактивировать
            </button>
            <button type="button" className="btn btn-secondary" onClick={closeEdit}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}