import { api } from './client';

export function listUserActions() {
  return api<Record<string, unknown>[]>('/api/v1/logs/user-actions');
}

export function clearUserActions() {
  return api('/api/v1/logs/user-actions', { method: 'DELETE' });
}