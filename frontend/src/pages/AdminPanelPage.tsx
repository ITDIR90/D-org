import { useCallback, useEffect, useState } from 'react';
import {
  listAdminMedia, getAdminMediaStats, listAdminOrphans,
  deleteAdminMedia, deleteAdminMediaBatch, deleteAdminOrphans,
  listAdminArchived, purgeAdminTask, purgeAdminTasks,
  getAdminDbStats, downloadAdminBackup,
  attachmentFileUrl,
} from '../api/admin';
import type {
  AdminMediaItem, AdminMediaStats, AdminOrphanFile, AdminArchivedTask,
  MediaCleanupResult, PurgeResult, DbStats,
} from '../api/admin';
import { formatSize } from '../api/attachments';
import { showToast } from '../utils/toast';

type Tab = 'media' | 'archive';

function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleString('ru-RU') : '—';
}

export function AdminPanelPage() {
  const [tab, setTab] = useState<Tab>('media');
  const [media, setMedia] = useState<AdminMediaItem[]>([]);
  const [stats, setStats] = useState<AdminMediaStats | null>(null);
  const [orphans, setOrphans] = useState<AdminOrphanFile[]>([]);
  const [archived, setArchived] = useState<AdminArchivedTask[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [backuping, setBackuping] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadMedia = useCallback(() => {
    Promise.all([listAdminMedia(), getAdminMediaStats(), listAdminOrphans()])
      .then(([m, s, o]) => { setMedia(m); setStats(s); setOrphans(o); })
      .catch(() => setError('Не удалось загрузить картинки'));
  }, []);

  const loadArchived = useCallback(() => {
    listAdminArchived()
      .then(setArchived)
      .catch(() => setError('Не удалось загрузить архив задач'));
  }, []);

  const loadDbStats = useCallback(() => {
    getAdminDbStats()
      .then(setDbStats)
      .catch(() => setError('Не удалось загрузить размер базы данных'));
  }, []);

  const handleBackup = async () => {
    setBackuping(true);
    setError('');
    try {
      const name = await downloadAdminBackup();
      showToast(`Резервная копия сохранена: ${name}`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка выгрузки бэкапа');
    } finally {
      setBackuping(false);
    }
  };

  useEffect(() => {
    loadMedia();
    loadArchived();
    loadDbStats();
  }, [loadMedia, loadArchived, loadDbStats]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllMedia = () => {
    setSelected((prev) =>
      prev.size === media.length ? new Set() : new Set(media.map((m) => m.id)),
    );
  };

  const confirmPurge = (title: string, action: string): boolean =>
    window.confirm(`${action}\n\nЭто действие необратимо. Уверены?`);

  const handleDeleteMediaOne = async (item: AdminMediaItem) => {
    if (!confirmPurge(item.original_name, `Удалить изображение «${item.original_name}» (задача №${item.task_number ?? item.task_id})?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminMedia(item.id);
      showToast('Изображение удалено', 'success');
      loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMediaSelected = async () => {
    if (selected.size === 0) return;
    if (!confirmPurge(`${selected.size} изображений`, `Удалить выбранные изображения (${selected.size})?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await deleteAdminMediaBatch({ ids: Array.from(selected) });
      showToast(`Удалено изображений: ${res.deleted_records}`, 'success');
      setSelected(new Set());
      loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOrphans = async () => {
    if (orphans.length === 0) return;
    if (!confirmPurge(`${orphans.length} файлов без записей`, `Удалить осиротевшие файлы на диске (${orphans.length})?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await deleteAdminOrphans();
      showToast(`Освобождено: ${formatSize(res.freed_bytes)}`, 'success');
      loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeTask = async (t: AdminArchivedTask) => {
    if (!confirmPurge(`Задача №${t.number} «${t.title}»`,
      `Безвозвратно удалить задачу №${t.number} и всё связанное (${t.total_related} записей, ${formatSize(t.total_bytes)})?`)) return;
    setBusy(true);
    setError('');
    try {
      await purgeAdminTask(t.id);
      showToast(`Задача №${t.number} удалена`, 'success');
      loadArchived();
      loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeArchivedSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirmPurge(`${ids.length} задач`, `Безвозвратно удалить ${ids.length} выбранных архивных задач и всё связанное?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await purgeAdminTasks(ids);
      showToast(`Удалено задач: ${res.purged_tasks}, картинок: ${res.deleted_attachments}`, 'success');
      setSelected(new Set());
      loadArchived();
      loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Администрирование</h1>
        <div className="admin-tabs">
          <button className={`btn btn-sm ${tab === 'media' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('media')}>
            Картинки {stats ? `(${stats.total_count})` : ''}
          </button>
          <button className={`btn btn-sm ${tab === 'archive' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('archive')}>
            Архивные задачи {archived.length ? `(${archived.length})` : ''}
          </button>
        </div>
      </div>

      {error && <div className="action-toast action-toast--error">{error}</div>}

      {dbStats && (
        <div className="db-stats-card">
          <div className="db-stats-title">
            База данных «{dbStats.database_name}»
            <span className="db-stats-actions">
              <button className="btn btn-sm" disabled={backuping} onClick={() => void handleBackup()}>
                {backuping ? 'Формируем бэкап…' : 'Скачать бэкап БД'}
              </button>
            </span>
          </div>
          <div className="db-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-value">{formatSize(dbStats.total_bytes)}</span>
              <span className="admin-stat-label">общий размер БД</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{dbStats.tables_count}</span>
              <span className="admin-stat-label">таблиц</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-value">{dbStats.rows_total.toLocaleString('ru-RU')}</span>
              <span className="admin-stat-label">строк в таблицах</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'media' && (
        <>
          {stats && (
            <div className="admin-stats-row">
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.total_count}</span>
                <span className="admin-stat-label">изображений</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{formatSize(stats.total_bytes)}</span>
                <span className="admin-stat-label">всего на диске</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value" style={{ color: stats.orphan_files ? 'var(--color-danger)' : '' }}>{stats.orphan_files}</span>
                <span className="admin-stat-label">файлов-сирот</span>
              </div>
            </div>
          )}

          {orphans.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2>{orphans.length} осиротевших файлов на диске (без записей)</h2>
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void handleDeleteOrphans()}>
                Удалить осиротевшие файлы
              </button>
            </div>
          )}

          <div className="card">
            <h2>Все изображения портала</h2>
            {media.length === 0 ? (
              <p className="empty">Нет изображений</p>
            ) : (
              <>
                <div className="admin-bulk-bar">
                  <label className="admin-checkbox">
                    <input type="checkbox" checked={selected.size === media.length && media.length > 0} onChange={toggleAllMedia} />
                    Выбрать все
                  </label>
                  <button className="btn btn-danger btn-sm" disabled={busy || selected.size === 0} onClick={() => void handleDeleteMediaSelected()}>
                    Удалить выбранные ({selected.size})
                  </button>
                </div>
                <div className="admin-media-grid">
                  {media.map((m) => (
                    <div key={m.id} className={`admin-media-item${selected.has(m.id) ? ' selected' : ''}`}>
                      <a href={attachmentFileUrl(m.url)} target="_blank" rel="noreferrer">
                        <img src={attachmentFileUrl(m.url)} alt={m.original_name} loading="lazy" />
                      </a>
                      <div className="admin-media-meta">
                        <div className="admin-media-name" title={m.original_name}>{m.original_name}</div>
                        <div className="muted">Задача №{m.task_number ?? m.task_id}{m.task_title ? ` · ${m.task_title}` : ''}</div>
                        <div className="muted">Загрузил: {m.uploaded_by_name || '—'} · {fmtDate(m.created_at)}</div>
                        <div className="muted">{formatSize(m.size_bytes)}</div>
                        <div className="admin-media-actions">
                          <label className="admin-checkbox">
                            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} />
                            Выбрать
                          </label>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void handleDeleteMediaOne(m)}>Удалить</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'archive' && (
        <div className="card">
          <h2>Архивные задачи (безвозвратное удаление)</h2>
          {archived.length === 0 ? (
            <p className="empty">Нет архивных задач</p>
          ) : (
            <>
              <div className="admin-bulk-bar">
                <button className="btn btn-danger btn-sm" disabled={busy || selected.size === 0} onClick={() => void handlePurgeArchivedSelected()}>
                  Удалить выбранные ({selected.size})
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={selected.size === archived.length} onChange={() => setSelected(prev => prev.size === archived.length ? new Set() : new Set(archived.map(a => a.id)))} /></th>
                      <th>№</th>
                      <th>Название</th>
                      <th>Исполнитель / автор</th>
                      <th>Архивирована</th>
                      <th>Связано</th>
                      <th>Объём</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archived.map((t) => (
                      <tr key={t.id}>
                        <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                        <td>{t.number}</td>
                        <td>{t.title}</td>
                        <td>{t.assignee_name || '—'} ({t.author_name || '—'})</td>
                        <td>{fmtDate(t.updated_at)}</td>
                        <td>{t.total_related} ({t.attachments_count} влож., {t.comments_count} комм., {t.change_logs_count} журн., {t.notifications_count} увед.)</td>
                        <td>{formatSize(t.total_bytes)}</td>
                        <td><button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void handlePurgeTask(t)}>Удалить</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
