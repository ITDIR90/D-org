import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  activateRequestTemplate,
  createRequestTemplate,
  deactivateRequestTemplate,
  listRequestTemplates,
  updateRequestTemplate,
  type RequestTemplate,
} from '../api/requestTemplates';
import { listCategories } from '../api/categories';
import { listGroups } from '../api/groups';
import { listUsers } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal/Modal';
import { IconGear } from '../components/Icons/IconGear';
import { SortableTh } from '../components/Table/SortableTh';
import { TasksSectionNav } from '../components/Tasks/TasksSectionNav';
import { useTableSort } from '../hooks/useTableSort';

const EMPTY_CREATE = {
  name: '',
  title: '',
  description: '',
  target_group_id: '',
  category_id: '',
  priority: 'medium',
  default_assignee_id: '',
  sort_order: 0,
};

type TemplateForm = typeof EMPTY_CREATE;

function templateToForm(t: RequestTemplate): TemplateForm {
  return {
    name: t.name,
    title: t.title,
    description: t.description || '',
    target_group_id: String(t.target_group_id),
    category_id: String(t.category_id),
    priority: t.priority,
    default_assignee_id: t.default_assignee_id ? String(t.default_assignee_id) : '',
    sort_order: t.sort_order,
  };
}

export function RequestTemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'group_admin';
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; group_id: number }[]>([]);
  const [users, setUsers] = useState<{ id: number; full_name: string; member_group_ids?: number[] }[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editTemplate, setEditTemplate] = useState<RequestTemplate | null>(null);
  const [editForm, setEditForm] = useState<TemplateForm>(EMPTY_CREATE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => listRequestTemplates(true).then(setTemplates).catch(() => {});
  useEffect(() => {
    load();
    listGroups().then(setGroups).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
    listUsers().then(setUsers).catch(() => {});
  }, []);

  const groupName = (id: number) => groups.find((g) => g.id === id)?.name || String(id);
  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name || String(id);

  const accessors = useMemo(() => ({
    name: (t: RequestTemplate) => t.name,
    title: (t: RequestTemplate) => t.title,
    group: (t: RequestTemplate) => t.group_name || groupName(t.target_group_id),
    category: (t: RequestTemplate) => t.category_name || categoryName(t.category_id),
    active: (t: RequestTemplate) => (t.is_active ? 1 : 0),
    sort: (t: RequestTemplate) => t.sort_order,
  }), [groups, categories]);

  const { sorted, sortKey, direction, toggleSort } = useTableSort(templates, accessors);

  if (!isAdmin) {
    return <Navigate to="/tasks/my" replace />;
  }

  const filteredCategories = (groupId: string) =>
    categories.filter((c) => !groupId || c.group_id === Number(groupId));

  const groupMembers = (groupId: string) =>
    groupId ? users.filter((u) => u.member_group_ids?.includes(Number(groupId))) : [];

  const openEdit = (t: RequestTemplate) => {
    setEditTemplate(t);
    setEditForm(templateToForm(t));
    setError('');
  };

  const closeEdit = () => {
    setEditTemplate(null);
    setError('');
  };

  const buildPayload = (form: TemplateForm) => ({
    name: form.name,
    title: form.title,
    description: form.description || undefined,
    target_group_id: Number(form.target_group_id),
    category_id: Number(form.category_id),
    priority: form.priority,
    sort_order: Number(form.sort_order) || 0,
    default_assignee_id: form.default_assignee_id ? Number(form.default_assignee_id) : undefined,
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createRequestTemplate(buildPayload(createForm));
      setCreateForm(EMPTY_CREATE);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTemplate) return;
    setError('');
    setSaving(true);
    try {
      await updateRequestTemplate(editTemplate.id, buildPayload(editForm));
      closeEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = (
    form: TemplateForm,
    setForm: (f: TemplateForm) => void,
    idPrefix: string,
  ) => {
    const cats = filteredCategories(form.target_group_id);
    const members = groupMembers(form.target_group_id);
    return (
      <>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${idPrefix}-name`}>Название шаблона *</label>
            <input
              id={`${idPrefix}-name`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Заправка принтера"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-sort`}>Порядок</label>
            <input
              id={`${idPrefix}-sort`}
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              min={0}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor={`${idPrefix}-title`}>Тема заявки *</label>
          <input
            id={`${idPrefix}-title`}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Заправить принтер"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor={`${idPrefix}-desc`}>Описание по умолчанию</label>
          <textarea
            id={`${idPrefix}-desc`}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${idPrefix}-group`}>Группа *</label>
            <select
              id={`${idPrefix}-group`}
              value={form.target_group_id}
              onChange={(e) => setForm({
                ...form,
                target_group_id: e.target.value,
                category_id: '',
                default_assignee_id: '',
              })}
              required
            >
              <option value="">Выберите</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-cat`}>Категория *</label>
            <select
              id={`${idPrefix}-cat`}
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              required
              disabled={!form.target_group_id}
            >
              <option value="">Выберите</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${idPrefix}-priority`}>Важность</label>
            <select
              id={`${idPrefix}-priority`}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="medium">Средняя</option>
              <option value="high">Важно</option>
              <option value="ferrari">Феррари</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-assignee`}>Ответственный по умолчанию</label>
            <select
              id={`${idPrefix}-assignee`}
              value={form.default_assignee_id}
              onChange={(e) => setForm({ ...form, default_assignee_id: e.target.value })}
              disabled={!form.target_group_id}
            >
              <option value="">Не назначен</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </>
    );
  };

  return (
    <div>
      <TasksSectionNav />
      <div className="page-header">
        <h1>Шаблоны заявок</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-subtitle">Новый шаблон</h2>
        <form onSubmit={handleCreate}>
          {renderFormFields(createForm, setCreateForm, 'create')}
          {error && !editTemplate && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Создать шаблон'}
          </button>
        </form>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Шаблон" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Тема" sortKey="title" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Группа" sortKey="group" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Категория" sortKey="category" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Порядок" sortKey="sort" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Активен" sortKey="active" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.title}</td>
                <td>{t.group_name || groupName(t.target_group_id)}</td>
                <td>{t.category_name || categoryName(t.category_id)}</td>
                <td>{t.sort_order}</td>
                <td>
                  <span className={`status-dot ${t.is_active ? 'status-dot--active' : 'status-dot--inactive'}`}>
                    {t.is_active ? 'Да' : 'Нет'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn-icon-action"
                      onClick={() => openEdit(t)}
                      title="Редактировать"
                      aria-label={`Редактировать ${t.name}`}
                    >
                      <IconGear size={17} />
                    </button>
                    {t.is_active ? (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deactivateRequestTemplate(t.id).then(load)}
                      >
                        Отключить
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => activateRequestTemplate(t.id).then(load)}
                      >
                        Включить
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editTemplate} onClose={closeEdit} title={editTemplate ? `Редактирование: ${editTemplate.name}` : ''}>
        <form onSubmit={handleUpdate}>
          {renderFormFields(editForm, setEditForm, 'edit')}
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
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
