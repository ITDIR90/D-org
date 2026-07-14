import { api } from './client';

export interface Task {
  id: number;
  number: number;
  title: string;
  description?: string;
  author_id: number;
  author_group_id: number;
  target_group_id: number;
  category_id: number;
  due_at: string;
  notify_before_minutes: number;
  assignee_id?: number;
  completed_at?: string;
  priority: string;
  status: string;
  spent_hours?: number;
  is_overdue: boolean;
  author_name?: string;
  assignee_name?: string;
  category_name?: string;
  target_group_name?: string;
  created_at: string;
}

export interface Comment {
  id: number;
  text: string;
  author_id: number;
  author_name?: string;
  created_at: string;
}

export interface ChangeLog {
  id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by_name?: string;
  changed_at: string;
}

export function listTasks(params: Record<string, string | boolean> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === true) qs.set(k, 'true');
    else if (typeof v === 'string' && v) qs.set(k, v);
  });
  const q = qs.toString();
  return api<Task[]>(`/api/v1/tasks${q ? '?' + q : ''}`);
}

export function getTask(id: number) {
  return api<Task>(`/api/v1/tasks/${id}`);
}

export function createTask(data: object) {
  return api<{ message: string; ai_corrected: boolean }>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(id: number, data: object) {
  return api<{ message: string; ai_corrected: boolean }>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function taskAction(id: number, action: string) {
  return api<Task>(`/api/v1/tasks/${id}/${action}`, { method: 'POST', body: '{}' });
}

export function getComments(taskId: number) {
  return api<Comment[]>(`/api/v1/tasks/${taskId}/comments`);
}

export function addComment(taskId: number, text: string) {
  return api<{ message: string; ai_corrected: boolean }>(`/api/v1/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function getHistory(taskId: number) {
  return api<ChangeLog[]>(`/api/v1/tasks/${taskId}/history`);
}

export function listInfopanelTasks() {
  return api<Task[]>('/api/v1/tasks/infopanel');
}
