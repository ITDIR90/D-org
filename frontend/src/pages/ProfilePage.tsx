import { useEffect, useState, type FormEvent } from 'react';
import { changePassword } from '../api/auth';
import { updateUser } from '../api/users';
import { getNotificationChannels, testNotifications } from '../api/notifications';
import { listGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import {
  EMPTY_CREATE,
  EMPTY_PASSWORD,
  UserFormFields,
  userToForm,
  type UserForm,
} from '../components/User/UserFormFields';

function parseMaxUserId(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProfilePage() {
  const { user: me, refresh } = useAuth();
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState<UserForm>(EMPTY_CREATE);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string>('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getNotificationChannels()
      .then((ch) => {
        const parts: string[] = [];
        if (!ch.email.ready) parts.push(`Email: ${ch.email.reason}`);
        if (!ch.telegram.ready) parts.push(`Telegram: ${ch.telegram.reason}`);
        if (!ch.max.ready) parts.push(`MAX: ${ch.max.reason}`);
        setChannelStatus(parts.join(' · '));
      })
      .catch(() => {});
  }, []);

  const isSuperadmin = me?.role === 'superadmin';
  const canManage = isSuperadmin || me?.role === 'group_admin';
  const selfOnly = !canManage;

  useEffect(() => {
    if (me) {
      setForm(userToForm(me));
      setPasswordForm(EMPTY_PASSWORD);
      setError('');
      setSuccess('');
    }
  }, [me]);

  useEffect(() => {
    if (canManage) {
      listGroups().then(setGroups).catch(() => {});
    }
  }, [canManage]);

  const validatePassword = (): string | null => {
    const { expanded, current, new: newPass, confirm } = passwordForm;
    if (!expanded) return null;
    if (!newPass) return 'Введите новый пароль';
    if (newPass.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (newPass !== confirm) return 'Пароли не совпадают';
    if (!current) return 'Введите текущий пароль';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;

    const pwdError = validatePassword();
    if (pwdError) {
      setError(pwdError);
      setSuccess('');
      return;
    }

    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateUser(me.id, {
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        nickname: form.nickname,
        email: form.email,
        timezone: form.timezone,
        ui_theme: form.ui_theme,
        notify_via_email: form.notify_via_email,
        notify_via_telegram: form.notify_via_telegram,
        notify_via_max: form.notify_via_max,
        ...(canManage && !selfOnly
          ? {
              telegram_chat_id: form.telegram_chat_id || null,
              max_user_id: parseMaxUserId(form.max_user_id),
            }
          : {}),
        role: selfOnly ? undefined : form.role,
        member_group_ids: selfOnly ? undefined : form.member_group_ids,
        task_target_group_ids: selfOnly ? undefined : form.task_target_group_ids,
      });

      const { expanded, new: newPass, current } = passwordForm;
      if (expanded && newPass) {
        await changePassword(current, newPass);
      }

      await refresh();
      setPasswordForm(EMPTY_PASSWORD);
      setSuccess('Изменения сохранены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotifications = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      const res = await testNotifications();
      const sent = [
        res.delivery.email && 'email',
        res.delivery.telegram && 'telegram',
        res.delivery.max && 'MAX',
      ].filter(Boolean);
      const maxIssue = res.delivery.skipped.find((item) => item.startsWith('max:'));
      if (sent.length > 0) {
        let message = `Тест отправлен: ${sent.join(', ')}`;
        if (maxIssue && !res.delivery.max) {
          message += `. ${maxIssue}`;
        }
        setSuccess(message);
      } else if (maxIssue) {
        setError(maxIssue);
      } else {
        setError(res.delivery.skipped.join('; ') || 'Ни один канал не отправил сообщение');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка теста');
    } finally {
      setTesting(false);
    }
  };

  const setGroupField = (
    field: 'member_group_ids' | 'task_target_group_ids',
    ids: number[],
  ) => setForm((prev) => ({ ...prev, [field]: ids }));

  if (!me) {
    return null;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Настройки профиля</h1>
      </div>

      <div className="card profile-card">
        <form onSubmit={handleSubmit}>
          <UserFormFields
            isEdit
            selfOnly={selfOnly}
            form={form}
            setForm={setForm}
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            groups={groups}
            canManage={canManage}
            isSuperadmin={!!isSuperadmin}
            editUserId={me.id}
            meId={me.id}
            onGroupFieldChange={setGroupField}
          />
          {channelStatus && <p className="form-hint">{channelStatus}</p>}
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={testing}
              onClick={handleTestNotifications}
            >
              {testing ? 'Отправка...' : 'Проверить уведомления'}
            </button>
          </div>
          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
