import { API_URL, getToken } from './client';

export interface TaskAttachment {
  id: number;
  task_id: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by_name?: string | null;
  url: string;
}

async function handleError(res: Response): Promise<never> {
  let message = `Ошибка ${res.status}`;
  try {
    const err = await res.json();
    if (err && typeof err.detail === 'string') message = err.detail;
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function attachmentFileUrl(url: string): string {
  const token = getToken();
  const sep = url.includes('?') ? '&' : '?';
  return `${API_URL}${url}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

export async function listTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/attachments`, {
    headers: authHeaders(),
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function uploadTaskAttachment(taskId: number, file: File): Promise<TaskAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function deleteTaskAttachment(taskId: number, attachmentId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return handleError(res);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
