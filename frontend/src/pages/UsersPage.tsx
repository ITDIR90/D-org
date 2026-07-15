import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listUsers, createUser, updateUser, deactivateUser, activateUser, resetUserPassword } from '../api/users';
import { changePassword } from '../api/auth';
import type { User } from '../api/auth';
import { listGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal/Modal';
import { IconGear } from '../components/Icons/IconGear';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';
import {
  EMPTY_CREATE,
  EMPTY_PASSWORD,
  UserFormFields,
  userToForm,
  type UserForm,
} from '../components/User/UserFormFields';

import { ROLE_LABELS, ROLES } from '../constants/roles';

const USER_SORT_ACCESSORS = {
  full_name: (u: User) => u.full_name,
  email: (u: User) => u.email,
  role: (u: User) => ROLE_LABELS[u.role] || u.role,
  is_active: (u: User) => (u.is_active ? 1 : 0),
};

function parseMaxUserId(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function notificationPayload(form: UserForm) {
  return {
    notify_via_email: form.notify_via_email,
    notify_via_telegram: form.notify_via_telegram,
    notify_via_max: form.notify_via_max,
    telegram_chat_id: form.telegram_chat_id || null,
    max_user_id: parseMaxUserId(form.max_user_id),
  };
}

function serializeUserForm(f: UserForm): string {
  return JSON.stringify({
    ...f,
    member_group_ids: [...f.member_group_ids].sort((a, b) => a - b),
    task_target_group_ids: [...f.task_target_group_ids].sort((a, b) => a - b),
  });
}

function isPasswordFormDirty(p: typeof EMPTY_PASSWORD): boolean {
  return p.expanded && Boolean(p.current || p.new || p.confirm);
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_CREATE);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isSuperadmin = me?.role === 'superadmin';
  const canManage = isSuperadmin || me?.role === 'group_admin';

  const load = () => listUsers().then(setUsers).catch(() => {});
  useEffect(() => { load(); listGroups().then(setGroups).catch(() => {}); }, []);

  const accessors = useMemo(() => USER_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(users, accessors);

  const resetPasswordForm = () => setPasswordForm(EMPTY_PASSWORD);

  const openCreate = () => {
    setEditUser(null);
    setForm(EMPTY_CREATE);
    resetPasswordForm();
    setError('');
    setShowCreate(true);
  };

  const openEdit = (u: User) => {
    setShowCreate(false);
    setEditUser(u);
    setForm(userToForm(u));
    resetPasswordForm();
    setError('');
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditUser(null);
    resetPasswordForm();
    setError('');
  };

  const isModalDirty = (): boolean => {
    if (isPasswordFormDirty(passwordForm)) return true;
    if (showCreate) {
      return serializeUserForm(form) !== serializeUserForm(EMPTY_CREATE);
    }
    if (editUser) {
      return serializeUserForm(form) !== serializeUserForm(userToForm(editUser));
    }
    return false;
  };

  const requestCloseModal = () => {
    if (isModalDirty()) {
      const confirmed = window.confirm(
        'Закрыть окно без сохранения? Введённые данные будут потеряны.',
      );
      if (!confirmed) return;
    }
    closeModal();
  };

  const validateRequestOnlyRole = (): string | null => {
    if (form.role !== ROLES.REQUEST_ONLY) return null;
    if (form.task_target_group_ids.length === 0) {
      return 'Для роли «Только оформление заявок» выберите хотя бы одну группу';
    }
    return null;
  };

  const validatePassword = (isSelf: boolean): string | null => {
    const { expanded, current, new: newPass, confirm } = passwordForm;
    if (!expanded) return null;
    if (!newPass) {
      if (isSelf) return 'Введите новый пароль';
      return null;
    }
    if (newPass.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (newPass !== confirm) return 'Пароли не совпадают';
    if (isSelf && !current) return 'Введите текущий пароль';
    return null;
  };

  const applyPasswordChange = async (targetId: number, isSelf: boolean) => {
    const { new: newPass, current } = passwordForm;
    if (!passwordForm.expanded || !newPass) return;
    if (isSelf) {
      await changePassword(current, newPass);
    } else {
      await resetUserPassword(targetId, newPass);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const roleError = validateRequestOnlyRole();
    if (roleError) {
      setError(roleError);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createUser({
        ...form,
        middle_name: form.middle_name || undefined,
        ...notificationPayload(form),
      });
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    const isSelf = editUser.id === me?.id;
    const selfOnly = isSelf && !canManage;
    const roleError = selfOnly ? null : validateRequestOnlyRole();
    if (roleError) {
      setError(roleError);
      return;
    }
    const pwdError = validatePassword(isSelf);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setError('');
    setSaving(true);
    try {
      await updateUser(editUser.id, {
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        nickname: form.nickname,
        email: form.email,
        timezone: form.timezone,
        ui_theme: form.ui_theme,
        printer: selfOnly ? undefined : form.printer,
        role: selfOnly ? undefined : form.role,
        member_group_ids: selfOnly ? undefined : form.member_group_ids,
        task_target_group_ids: selfOnly ? undefined : form.task_target_group_ids,
        ...(isSelf
          ? {
              notify_via_email: form.notify_via_email,
              notify_via_telegram: form.notify_via_telegram,
              notify_via_max: form.notify_via_max,
            }
          : canManage
            ? notificationPayload(form)
            : {}),
      });
      await applyPasswordChange(editUser.id, isSelf);
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const setGroupField = (
    field: 'member_group_ids' | 'task_target_group_ids',
    ids: number[],
  ) => setForm((prev) => ({ ...prev, [field]: ids }));

  const formFieldsProps = {
    form,
    setForm,
    passwordForm,
    setPasswordForm,
    groups,
    canManage,
    isSuperadmin,
    editUserId: editUser?.id,
    meId: me?.id,
    onGroupFieldChange: setGroupField,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Пользователи</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={openCreate}>Создать пользователя</button>
        )}
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="ФИО" sortKey="full_name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Email" sortKey="email" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Принтер</th>
              <SortableTh label="Роль" sortKey="role" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Активен" sortKey="is_active" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="user-cell-name">{u.full_name}</span>
                  <span className="user-cell-nick">@{u.nickname}</span>
                </td>
                <td>{u.email}</td>
                <td>{u.printer || '—'}</td>
                <td><span className={`role-badge role-badge--${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td>
                  <span className={`status-dot ${u.is_active ? 'status-dot--active' : 'status-dot--inactive'}`}>
                    {u.is_active ? 'Да' : 'Нет'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    {(canManage || u.id === me?.id) && (
                      <button
                        className="btn-icon-action"
                        onClick={() => openEdit(u)}
                        title="Редактировать"
                        aria-label={`Редактировать ${u.full_name}`}
                      >
                        <IconGear size={17} />
                      </button>
                    )}
                    {canManage && u.is_active && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deactivateUser(u.id).then(load)}
                        disabled={u.id === me?.id}
                      >
                        Закрыть доступ
                      </button>
                    )}
                    {canManage && !u.is_active && (
                      <button className="btn btn-secondary btn-sm" onClick={() => activateUser(u.id).then(load)}>
                        Восстановить
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={requestCloseModal} title="Новый пользователь">
        <form onSubmit={handleCreate}>
          <UserFormFields isEdit={false} {...formFieldsProps} />
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={requestCloseModal}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={requestCloseModal} title={editUser ? `Редактирование: ${editUser.full_name}` : ''}>
        <form onSubmit={handleUpdate}>
          <UserFormFields
            isEdit={true}
            selfOnly={!!editUser && editUser.id === me?.id && !canManage}
            {...formFieldsProps}
          />
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={requestCloseModal}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
