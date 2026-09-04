import { api, API_URL, getToken } from './client';
import { attachmentFileUrl } from './attachments';

export interface AdminMediaItem {
  id: number;
  task_id: number;
  task_number?: number | null;
  task_title?: string | null;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by_name?: string | null;
  url: string;
}

export interface AdminMediaStats {
  total_count: number;
  total_bytes: number;
  orphan_files: number;
  orphan_files_bytes: number;
  orphan_records: number;
}

export interface AdminOrphanFile {
  stored_name: string;
  size_bytes: number;
}

export interface MediaCleanupResult {
  deleted_records: number;
  freed_bytes: number;
}

export interface AdminArchivedTask {
  id: number;
  number: number;
  title: string;
  category_name?: string | null;
  target_group_name?: string | null;
  author_name?: string | null;
  assignee_name?: string | null;
  updated_at?: string | null;
  attachments_count: number;
  comments_count: number;
  change_logs_count: number;
  notifications_count: number;
  total_bytes: number;
  total_related: number;
}

export interface PurgeResult {
  purged_tasks: number;
  deleted_tasks: number;
  deleted_attachments: number;
  freed_bytes: number;
}

export interface DbStats {
  database_name: string;
  total_bytes: number;
  tables_count: number;
  rows_total: number;
}

export function getAdminDbStats() {
  return api<DbStats>('/api/v1/admin/db/stats');
}

export async function downloadAdminBackup(): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/admin/db/backup`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = /filename="?([^";]+)"?/.exec(cd);
  const filename = match ? match[1] : `helpdesk_${new Date().toISOString().slice(0, 10)}.sql`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export function listAdminMedia(params?: { older_than_days?: number; task_id?: number }) {
  const q = new URLSearchParams();
  if (params?.older_than_days) q.set('older_than_days', String(params.older_than_days));
  if (params?.task_id) q.set('task_id', String(params.task_id));
  const qs = q.toString();
  return api<AdminMediaItem[]>(`/api/v1/admin/media${qs ? `?${qs}` : ''}`);
}

export function getAdminMediaStats() {
  return api<AdminMediaStats>('/api/v1/admin/media/stats');
}

export function listAdminOrphans() {
  return api<AdminOrphanFile[]>('/api/v1/admin/media/orphans');
}

export function deleteAdminMedia(attachmentId: number): Promise<MediaCleanupResult> {
  return api<MediaCleanupResult>(`/api/v1/admin/media/${attachmentId}`, { method: 'DELETE' });
}

export function deleteAdminMediaBatch(params: {
  older_than_days?: number;
  task_id?: number;
  ids?: number[];
}): Promise<MediaCleanupResult> {
  const q = new URLSearchParams();
  if (params.older_than_days) q.set('older_than_days', String(params.older_than_days));
  if (params.task_id) q.set('task_id', String(params.task_id));
  (params.ids ?? []).forEach((id) => q.append('ids', String(id)));
  const qs = q.toString();
  return api<MediaCleanupResult>(`/api/v1/admin/media${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
}

export function deleteAdminOrphans(): Promise<MediaCleanupResult> {
  return api<MediaCleanupResult>('/api/v1/admin/media/orphans', { method: 'DELETE' });
}

export function listAdminArchived(params?: { older_than_days?: number }) {
  const q = new URLSearchParams();
  if (params?.older_than_days) q.set('older_than_days', String(params.older_than_days));
  const qs = q.toString();
  return api<AdminArchivedTask[]>(`/api/v1/admin/tasks/archived${qs ? `?${qs}` : ''}`);
}

export function purgeAdminTask(taskId: number): Promise<PurgeResult> {
  return api<PurgeResult>(`/api/v1/admin/tasks/${taskId}/purge`, { method: 'DELETE' });
}

export function purgeAdminTasks(ids: number[]): Promise<PurgeResult> {
  const qs = ids.map((i) => `ids=${i}`).join('&');
  return api<PurgeResult>(`/api/v1/admin/tasks/purge?${qs}`, { method: 'DELETE' });
}

export { attachmentFileUrl };
