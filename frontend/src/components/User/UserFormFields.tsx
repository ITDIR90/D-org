import type { Dispatch, SetStateAction } from 'react';
import type { User } from '../../api/auth';
import { TimezoneSelect } from '../Form/TimezoneSelect';
import { GroupMultiSelect } from '../Form/GroupMultiSelect';
import { PasswordChangeFields } from '../Form/PasswordChangeFields';
import { normalizeTimezone } from '../../constants/timezones';
import { normalizeUiTheme, type UiTheme } from '../../constants/themes';
import { applyUiTheme } from '../../theme/applyTheme';
import { ThemeSelect } from '../Form/ThemeSelect';
import { ROLE_LABELS, ROLES } from '../../constants/roles';

export const EMPTY_CREATE = {
  last_name: '',
  first_name: '',
  middle_name: '',
  nickname: '',
  email: '',
  password: 'user12345',
  role: 'user',
  timezone: 'Europe/Moscow',
  ui_theme: 'light' as UiTheme,
  member_group_ids: [] as number[],
  task_target_group_ids: [] as number[],
  notify_via_email: true,
  notify_via_telegram: false,
  telegram_chat_id: '',
};

export type UserForm = typeof EMPTY_CREATE;

export const EMPTY_PASSWORD = {
  expanded: false,
  current: '',
  new: '',
  confirm: '',
};

export type PasswordFormState = typeof EMPTY_PASSWORD;

export function userToForm(u: User): UserForm {
  return {
    last_name: u.last_name,
    first_name: u.first_name,
    middle_name: u.middle_name || '',
    nickname: u.nickname,
    email: u.email,
    password: '',
    role: u.role,
    timezone: normalizeTimezone(u.timezone),
    ui_theme: normalizeUiTheme(u.ui_theme),
    member_group_ids: [...u.member_group_ids],
    task_target_group_ids: [...u.task_target_group_ids],
    notify_via_email: u.notify_via_email ?? true,
    notify_via_telegram: u.notify_via_telegram ?? false,
    telegram_chat_id: u.telegram_chat_id || '',
  };
}

export interface UserFormFieldsProps {
  isEdit: boolean;
  selfOnly?: boolean;
  form: UserForm;
  setForm: Dispatch<SetStateAction<UserForm>>;
  passwordForm: PasswordFormState;
  setPasswordForm: Dispatch<SetStateAction<PasswordFormState>>;
  groups: { id: number; name: string }[];
  canManage: boolean;
  isSuperadmin: boolean;
  editUserId?: number;
  meId?: number;
  onGroupFieldChange: (field: 'member_group_ids' | 'task_target_group_ids', ids: number[]) => void;
}

export function UserFormFields({
  isEdit,
  selfOnly,
  form,
  setForm,
  passwordForm,
  setPasswordForm,
  groups,
  canManage,
  isSuperadmin,
  editUserId,
  meId,
  onGroupFieldChange,
}: UserFormFieldsProps) {
  const isSelf = isEdit && editUserId === meId;
  const showPassword = isEdit && (isSelf || (canManage && !selfOnly));
  const isRequestOnlyRole = form.role === ROLES.REQUEST_ONLY;

  const handleRoleChange = (role: string) => {
    if (role === ROLES.REQUEST_ONLY) {
      setForm({ ...form, role, member_group_ids: [] });
      return;
    }
    setForm({ ...form, role });
  };

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Фамилия</label>
          <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Имя</label>
          <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Отчество</label>
          <input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Ник</label>
          <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Часовой пояс</label>
          <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
        </div>
      </div>
      {isEdit && (
        <div className="form-group">
          <label>Тема оформления</label>
          <ThemeSelect
            value={form.ui_theme}
            onChange={(ui_theme) => {
              setForm({ ...form, ui_theme });
              if (isSelf) applyUiTheme(ui_theme);
            }}
          />
        </div>
      )}
      {!isEdit && (
        <div className="form-group">
          <label>Пароль</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
        </div>
      )}
      {showPassword && (
        <PasswordChangeFields
          isSelf={!!isSelf}
          expanded={passwordForm.expanded}
          currentPassword={passwordForm.current}
          newPassword={passwordForm.new}
          confirmPassword={passwordForm.confirm}
          onToggle={() => setPasswordForm((prev) => ({ ...prev, expanded: !prev.expanded }))}
          onCurrentChange={(current) => setPasswordForm((prev) => ({ ...prev, current }))}
          onNewChange={(newPass) => setPasswordForm((prev) => ({ ...prev, new: newPass }))}
          onConfirmChange={(confirm) => setPasswordForm((prev) => ({ ...prev, confirm }))}
        />
      )}
      {isSelf && (
        <div className="profile-notifications card" style={{ marginTop: '1.25rem', padding: '1rem 1.25rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Уведомления</h3>
          <p className="system-settings-hint" style={{ marginBottom: '1rem' }}>
            Выберите каналы для уведомлений о задачах. Мобильное приложение будет добавлено позже.
          </p>
          <label className="system-settings-toggle" style={{ marginBottom: '0.75rem' }}>
            <input
              type="checkbox"
              checked={form.notify_via_email}
              onChange={(e) => setForm({ ...form, notify_via_email: e.target.checked })}
            />
            <span>Email</span>
          </label>
          <label className="system-settings-toggle" style={{ marginBottom: '0.75rem' }}>
            <input
              type="checkbox"
              checked={form.notify_via_telegram}
              onChange={(e) => setForm({ ...form, notify_via_telegram: e.target.checked })}
            />
            <span>Telegram</span>
          </label>
          {form.notify_via_telegram && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Telegram Chat ID</label>
              <input
                value={form.telegram_chat_id}
                onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                placeholder="Например: 123456789"
              />
              <p className="form-hint">
                Напишите боту /start и укажите полученный chat_id. Настройте TELEGRAM_BOT_TOKEN на сервере.
              </p>
            </div>
          )}
        </div>
      )}
      {canManage && !selfOnly && (
        <div className="form-group">
          <label>Роль</label>
          <select
            value={form.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={!isSuperadmin && form.role === 'superadmin'}
          >
            <option value="user">Пользователь</option>
            <option value="group_admin">Администратор группы</option>
            <option value={ROLES.REQUEST_ONLY}>{ROLE_LABELS.request_only}</option>
            {isSuperadmin && <option value="superadmin">Супер-администратор</option>}
          </select>
        </div>
      )}
      {!selfOnly && !isRequestOnlyRole && (
        <GroupMultiSelect
          groups={groups}
          selected={form.member_group_ids}
          onChange={(ids) => onGroupFieldChange('member_group_ids', ids)}
          label="Группы участника"
          hint={
            form.role === 'group_admin'
              ? 'Администратор управляет задачами и категориями в этих группах'
              : 'Пользователь видит задачи и проекты этих групп'
          }
        />
      )}
      {canManage && !selfOnly && (
        <GroupMultiSelect
          groups={groups}
          selected={form.task_target_group_ids}
          onChange={(ids) => onGroupFieldChange('task_target_group_ids', ids)}
          label={isRequestOnlyRole ? 'Группы для оформления заявок' : 'Может ставить задачи в группы'}
          hint={
            isRequestOnlyRole
              ? 'Пользователь сможет оформлять заявки только в выбранные группы'
              : 'Даже если не является участником'
          }
        />
      )}
    </>
  );
}
