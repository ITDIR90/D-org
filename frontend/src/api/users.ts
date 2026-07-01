import { api } from './client';
import type { User } from './auth';

export function listUsers() {
  return api<User[]>('/api/v1/users');
}

export function createUser(data: object) {
  return api<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateUser(id: number, data: object) {
  return api<User>(`/api/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deactivateUser(id: number) {
  return api(`/api/v1/users/${id}/deactivate`, { method: 'POST' });
}

export function activateUser(id: number) {
  return api(`/api/v1/users/${id}/activate`, { method: 'POST' });
}

export function resetUserPassword(id: number, new_password: string) {
  return api(`/api/v1/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password }),
  });
}
