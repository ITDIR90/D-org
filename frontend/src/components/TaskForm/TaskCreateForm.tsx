import type { FormEvent } from 'react';

export interface TaskCreateFormData {
  title: string;
  description: string;
  target_group_id: string;
  category_id: string;
  priority: string;
  assignee_id: string;
  notify_before_minutes: string;
}

interface GroupOption {
  id: number;
  name: string;
}

interface CategoryOption {
  id: number;
  name: string;
  group_id: number;
}

interface UserOption {
  id: number;
  full_name: string;
  member_group_ids?: number[];
}

interface TaskCreateFormProps {
  form: TaskCreateFormData;
  setForm: (form: TaskCreateFormData) => void;
  groups: GroupOption[];
  categories: CategoryOption[];
  users: UserOption[];
  showAssignee: boolean;
  error?: string;
  submitLabel?: string;
  requesterMode?: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
}

export const EMPTY_TASK_FORM: TaskCreateFormData = {
  title: '',
  description: '',
  target_group_id: '',
  category_id: '',
  priority: 'medium',
  assignee_id: '',
  notify_before_minutes: '60',
};

export function TaskCreateForm({
  form,
  setForm,
  groups,
  categories,
  users,
  showAssignee,
  error,
  submitLabel,
  requesterMode = false,
  onSubmit,
  onCancel,
}: TaskCreateFormProps) {
  const filteredCats = categories.filter(
    (c) => !form.target_group_id || c.group_id === Number(form.target_group_id),
  );
  const groupId = Number(form.target_group_id);
  const groupMembers = form.target_group_id
    ? users.filter((u) => u.member_group_ids?.includes(groupId))
    : [];

  const handleGroupChange = (target_group_id: string) => {
    setForm({ ...form, target_group_id, category_id: '', assignee_id: '' });
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label>{requesterMode ? 'Тема заявки' : 'Название'} *</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label>{requesterMode ? 'Описание заявки' : 'Описание'}</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>{requesterMode ? 'Группа' : 'Группа-исполнитель'} *</label>
          <select
            value={form.target_group_id}
            onChange={(e) => handleGroupChange(e.target.value)}
            required
          >
            <option value="">Выберите</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Категория *</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            required
          >
            <option value="">Выберите</option>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      {showAssignee && (
        <div className="form-group">
          <label>Ответственный</label>
          <select
            value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            disabled={!form.target_group_id}
          >
            <option value="">Не назначен</option>
            {groupMembers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
          {!form.target_group_id && (
            <p className="form-hint">Сначала выберите группу-исполнителя</p>
          )}
        </div>
      )}
      <div className="form-group">
        <label>Важность</label>
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option value="medium">Средняя</option>
          <option value="high">Важно</option>
          <option value="ferrari">Феррари</option>
        </select>
      </div>
      <div className="form-group">
        <label>Уведомлять за (минут до срока)</label>
        <input
          type="number"
          min="0"
          max="10080"
          step="1"
          value={form.notify_before_minutes}
          onChange={(e) => setForm({ ...form, notify_before_minutes: e.target.value })}
        />
        <p className="form-hint">По умолчанию 60 минут. Укажите 0, чтобы отключить напоминание.</p>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className={onCancel ? 'modal-actions' : 'actions'}>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {submitLabel ?? (requesterMode ? 'Отправить заявку' : 'Создать')}
        </button>
      </div>
    </form>
  );
}
