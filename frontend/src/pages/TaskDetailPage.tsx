import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTask, getComments, getHistory, addComment,
  taskAction, updateTask,
} from '../api/tasks';
import type { Task, Comment, ChangeLog } from '../api/tasks';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge/PriorityBadge';
import { useAuth } from '../auth/AuthContext';
import { showAiNotice } from '../api/client';
import { listUsers } from '../api/users';
import { buildUserNameMap, formatChangeLogMessage } from '../utils/changeLogFormat';

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<ChangeLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [users, setUsers] = useState<{ id: number; full_name: string; member_group_ids?: number[] }[]>([]);
  const [spentHours, setSpentHours] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [notifyBeforeMinutes, setNotifyBeforeMinutes] = useState('60');

  const load = async () => {
    if (!id) return;
    const t = await getTask(Number(id));
    setTask(t);
    setEditAssigneeId(t.assignee_id ? String(t.assignee_id) : '');
    setEditDueAt(toDatetimeLocalValue(t.due_at));
    setNotifyBeforeMinutes(String(t.notify_before_minutes ?? 60));
    setComments(await getComments(Number(id)));
    setHistory(await getHistory(Number(id)));
  };

  useEffect(() => {
    load().catch(() => setActionError('Не удалось загрузить задачу'));
    listUsers().then(setUsers).catch(() => {});
  }, [id]);

  if (!task) return <p className="loading">Загрузка...</p>;

  const isSuperadmin = user?.role === 'superadmin';
  const isAuthor = user?.id === task.author_id;
  const isAssignee = user?.id === task.assignee_id;
  const isAdmin = isSuperadmin
    || (user?.role === 'group_admin' && (user?.admin_group_ids?.includes(task.target_group_id) ?? false));
  const isMember = isSuperadmin || (user?.member_group_ids?.includes(task.target_group_id) ?? false);
  const isActive = !['done', 'cancelled', 'archived'].includes(task.status);
  const canArchive = isAdmin && task.status !== 'archived';

  const groupMembers = users.filter((u) => u.member_group_ids?.includes(task.target_group_id));
  const userNames = buildUserNameMap(users);

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setActionError('');
    setTimeout(() => setActionMessage(''), 3000);
  };

  const doAction = async (action: string, successMsg: string) => {
    setActionLoading(action);
    setActionError('');
    try {
      const updated = await taskAction(task.id, action);
      setTask(updated);
      await load();
      showMessage(successMsg);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка выполнения действия');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssigneeSave = async () => {
    const nextId = editAssigneeId ? Number(editAssigneeId) : null;
    if (nextId === (task.assignee_id ?? null)) return;
    setActionLoading('assign');
    setActionError('');
    try {
      await updateTask(task.id, { assignee_id: nextId });
      await load();
      showMessage('Ответственный обновлён');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка назначения');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDueAtSave = async () => {
    if (!editDueAt) {
      setActionError('Укажите срок выполнения');
      return;
    }
    if (editDueAt === toDatetimeLocalValue(task.due_at)) return;
    setActionLoading('due');
    setActionError('');
    try {
      await updateTask(task.id, { due_at: new Date(editDueAt).toISOString() });
      await load();
      showMessage('Срок выполнения обновлён');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка сохранения срока');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await addComment(task.id, commentText);
      showAiNotice(res.ai_corrected);
      setCommentText('');
      await load();
      showMessage('Комментарий добавлен');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка отправки комментария');
    }
  };

  const handleSpent = async () => {
    if (!spentHours) return;
    setActionError('');
    try {
      await updateTask(task.id, { spent_hours: parseFloat(spentHours) });
      setSpentHours('');
      await load();
      showMessage('Затраченное время сохранено');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка сохранения времени');
    }
  };

  const handleNotifyBeforeSave = async () => {
    const next = Number(notifyBeforeMinutes);
    if (Number.isNaN(next) || next < 0) {
      setActionError('Укажите корректное количество минут');
      return;
    }
    if (next === task.notify_before_minutes) return;
    setActionLoading('notify');
    setActionError('');
    try {
      await updateTask(task.id, { notify_before_minutes: next });
      await load();
      showMessage('Настройка напоминания сохранена');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString('ru-RU') : '—';

  const canTake = isActive && task.status === 'new' && !task.assignee_id && isMember;
  const canStart = isActive && task.status === 'new' && isAssignee;
  const canComplete = isActive && ['new', 'in_progress'].includes(task.status) && (isAssignee || isAdmin);
  const canConfirm = task.status === 'waiting_author_confirmation' && (isAuthor || isSuperadmin);
  const canCancel = isActive && (isAuthor || isAdmin);
  const canEditReminder = isActive && (isAuthor || isAdmin);

  return (
    <div>
      <div className="page-header">
        <h1><span className="task-number-badge">№{task.number}</span> {task.title}</h1>
        <div className="actions">
          {canTake && (
            <button
              className="btn btn-primary btn-sm"
              disabled={!!actionLoading}
              onClick={() => doAction('take', 'Задача взята в работу')}
            >
              {actionLoading === 'take' ? '...' : 'Взять в работу'}
            </button>
          )}
          {canStart && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={!!actionLoading}
              onClick={() => doAction('start', 'Задача начата')}
            >
              {actionLoading === 'start' ? '...' : 'Начать'}
            </button>
          )}
          {canComplete && (
            <button
              className="btn btn-success btn-sm"
              disabled={!!actionLoading}
              onClick={() => doAction('complete', 'Задача выполнена')}
            >
              {actionLoading === 'complete' ? '...' : 'Выполнить'}
            </button>
          )}
          {canConfirm && (
            <button
              className="btn btn-success btn-sm"
              disabled={!!actionLoading}
              onClick={() => doAction('confirm', 'Выполнение подтверждено')}
            >
              {actionLoading === 'confirm' ? '...' : 'Подтвердить выполнение'}
            </button>
          )}
          {canCancel && (
            <button
              className="btn btn-danger btn-sm"
              disabled={!!actionLoading}
              onClick={() => {
                if (confirm('Отменить задачу?')) doAction('cancel', 'Задача отменена');
              }}
            >
              {actionLoading === 'cancel' ? '...' : 'Отменить'}
            </button>
          )}
          {canArchive && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={!!actionLoading}
              onClick={() => {
                if (confirm('Отправить задачу в архив? Она исчезнет из общих списков.')) {
                  doAction('archive', 'Задача отправлена в архив');
                }
              }}
            >
              {actionLoading === 'archive' ? '...' : 'В архив'}
            </button>
          )}
        </div>
      </div>

      {actionMessage && <div className="action-toast action-toast--success">{actionMessage}</div>}
      {actionError && <div className="action-toast action-toast--error">{actionError}</div>}

      <div className="card">
        <div className="detail-grid">
          <div className="detail-item"><label>Номер</label><span>№{task.number}</span></div>
          <div className="detail-item"><label>Статус</label><span><StatusBadge status={task.status} /></span></div>
          <div className="detail-item"><label>Важность</label><span><PriorityBadge priority={task.priority} /></span></div>
          <div className="detail-item"><label>Автор</label><span>{task.author_name}</span></div>
          <div className="detail-item"><label>Ответственный</label><span>{task.assignee_name || '—'}</span></div>
          <div className="detail-item"><label>Категория</label><span>{task.category_name}</span></div>
          <div className="detail-item"><label>Срок</label><span className={task.is_overdue ? 'overdue-tag' : ''}>{formatDate(task.due_at)}</span></div>
          <div className="detail-item"><label>Напоминание</label><span>{task.notify_before_minutes > 0 ? `за ${task.notify_before_minutes} мин.` : 'выключено'}</span></div>
          <div className="detail-item"><label>Затрачено</label><span>{task.spent_hours != null ? `${task.spent_hours} ч` : '—'}</span></div>
          <div className="detail-item"><label>Выполнена</label><span>{formatDate(task.completed_at)}</span></div>
        </div>
        {task.description && <p style={{ marginTop: '1rem' }}>{task.description}</p>}
      </div>

      {(isAdmin || isAssignee) && isActive && (
        <div className="task-edit-columns">
          {isAdmin && (
            <div className="card task-edit-column">
              <h2>Ответственный</h2>
              <div className="task-edit-field-row">
                <div className="form-group task-edit-field">
                  <label>Сотрудник группы</label>
                  <select
                    value={editAssigneeId}
                    onChange={(e) => setEditAssigneeId(e.target.value)}
                  >
                    <option value="">Не назначен</option>
                    {groupMembers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading === 'assign' || editAssigneeId === (task.assignee_id ? String(task.assignee_id) : '')}
                  onClick={handleAssigneeSave}
                >
                  {actionLoading === 'assign' ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="card task-edit-column">
              <h2>Срок выполнения</h2>
              <div className="task-edit-field-row">
                <div className="form-group task-edit-field">
                  <label>Дата и время</label>
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading === 'due' || editDueAt === toDatetimeLocalValue(task.due_at)}
                  onClick={handleDueAtSave}
                >
                  {actionLoading === 'due' ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {(isAssignee || isAdmin) && (
            <div className="card task-edit-column">
              <h2>Затраченное время</h2>
              <div className="task-edit-field-row">
                <div className="form-group task-edit-field">
                  <label>Часы</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={spentHours}
                    onChange={(e) => setSpentHours(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleSpent}>
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canEditReminder && (
        <div className="card">
          <h2>Напоминание о сроке</h2>
          <div className="task-edit-field-row">
            <div className="form-group task-edit-field">
              <label>Уведомлять за (минут до срока)</label>
              <input
                type="number"
                min="0"
                max="10080"
                step="1"
                value={notifyBeforeMinutes}
                onChange={(e) => setNotifyBeforeMinutes(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={actionLoading === 'notify' || Number(notifyBeforeMinutes) === task.notify_before_minutes}
              onClick={handleNotifyBeforeSave}
            >
              {actionLoading === 'notify' ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Комментарии</h2>
        <div className="comments-list">
          {comments.length === 0 ? <p className="empty">Нет комментариев</p> : comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-meta">{c.author_name} — {formatDate(c.created_at)}</div>
              <div>{c.text}</div>
            </div>
          ))}
        </div>
        <form onSubmit={handleComment} style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Добавить комментарий..." required />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Отправить</button>
        </form>
      </div>

      <div className="card">
        <h2>История изменений</h2>
        {history.length === 0 ? <p className="empty">Нет записей</p> : (
          <div className="change-log-list">
            {history.map((h) => (
              <div key={h.id} className="change-log-entry">
                <p className="change-log-text">{formatChangeLogMessage(h, userNames)}</p>
                <p className="change-log-meta">
                  {h.changed_by_name || 'Система'} · {formatDate(h.changed_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
