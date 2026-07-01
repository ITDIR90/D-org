import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listCategories, createCategory, updateCategory } from '../api/categories';
import { listGroups } from '../api/groups';
import { Modal } from '../components/Modal/Modal';
import { IconGear } from '../components/Icons/IconGear';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';

type CategoryRow = {
  id: number;
  name: string;
  group_id: number;
  default_due_days?: number;
  requires_author_confirmation: boolean;
};

const EMPTY_CREATE = {
  name: '',
  group_id: '',
  default_due_days: 2,
  requires_author_confirmation: false,
};

type CategoryForm = {
  name: string;
  default_due_days: number;
  requires_author_confirmation: boolean;
};

function categoryToForm(c: CategoryRow): CategoryForm {
  return {
    name: c.name,
    default_due_days: c.default_due_days ?? 2,
    requires_author_confirmation: c.requires_author_confirmation,
  };
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>({ name: '', default_due_days: 2, requires_author_confirmation: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => listCategories().then(setCategories).catch(() => {});
  useEffect(() => { load(); listGroups().then(setGroups).catch(() => {}); }, []);

  const groupName = (id: number) => groups.find((g) => g.id === id)?.name || String(id);

  const accessors = useMemo(() => ({
    name: (c: CategoryRow) => c.name,
    group: (c: CategoryRow) => groupName(c.group_id),
    due_days: (c: CategoryRow) => c.default_due_days ?? -1,
    confirmation: (c: CategoryRow) => (c.requires_author_confirmation ? 1 : 0),
  }), [groups]);

  const { sorted, sortKey, direction, toggleSort } = useTableSort(categories, accessors);

  const openEdit = (c: CategoryRow) => {
    setEditCategory(c);
    setEditForm(categoryToForm(c));
    setError('');
  };

  const closeEdit = () => {
    setEditCategory(null);
    setError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createCategory({
      name: createForm.name,
      group_id: Number(createForm.group_id),
      default_due_days: createForm.default_due_days,
      requires_author_confirmation: createForm.requires_author_confirmation,
    });
    setCreateForm(EMPTY_CREATE);
    load();
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    setError('');
    setSaving(true);
    try {
      await updateCategory(editCategory.id, {
        name: editForm.name,
        default_due_days: editForm.default_due_days,
        requires_author_confirmation: editForm.requires_author_confirmation,
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
    if (!editCategory) return;
    if (!window.confirm(`Деактивировать категорию «${editCategory.name}»?`)) return;
    setSaving(true);
    try {
      await updateCategory(editCategory.id, { is_active: false });
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
      <div className="page-header"><h1>Категории задач</h1></div>
      <div className="card" style={{ maxWidth: 500, marginBottom: '1rem' }}>
        <h2>Создать категорию</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Название</label>
            <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Группа</label>
            <select value={createForm.group_id} onChange={(e) => setCreateForm({ ...createForm, group_id: e.target.value })} required>
              <option value="">Выберите</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Срок по умолчанию (дней)</label>
            <input type="number" value={createForm.default_due_days} onChange={(e) => setCreateForm({ ...createForm, default_due_days: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={createForm.requires_author_confirmation}
                onChange={(e) => setCreateForm({ ...createForm, requires_author_confirmation: e.target.checked })}
              />
              {' '}Требует подтверждения автора
            </label>
          </div>
          <button type="submit" className="btn btn-primary">Создать</button>
        </form>
      </div>
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Название" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Группа" sortKey="group" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Срок (дней)" sortKey="due_days" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Подтверждение" sortKey="confirmation" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="data-table-row--clickable" onClick={() => openEdit(c)}>
                <td>{c.name}</td>
                <td>{groupName(c.group_id)}</td>
                <td>{c.default_due_days ?? '—'}</td>
                <td>{c.requires_author_confirmation ? 'Да' : 'Нет'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      title="Редактировать"
                      aria-label={`Редактировать ${c.name}`}
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

      <Modal open={!!editCategory} onClose={closeEdit} title={editCategory ? `Редактирование: ${editCategory.name}` : ''}>
        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label>Группа</label>
            <input value={editCategory ? groupName(editCategory.group_id) : ''} disabled />
          </div>
          <div className="form-group">
            <label>Название</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Срок по умолчанию (дней)</label>
            <input
              type="number"
              value={editForm.default_due_days}
              onChange={(e) => setEditForm({ ...editForm, default_due_days: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={editForm.requires_author_confirmation}
                onChange={(e) => setEditForm({ ...editForm, requires_author_confirmation: e.target.checked })}
              />
              {' '}Требует подтверждения автора
            </label>
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
