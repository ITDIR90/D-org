import { api } from './client';

export interface Group {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export function listGroups() {
  return api<Group[]>('/api/v1/groups');
}

export function createGroup(data: object) {
  return api<Group>('/api/v1/groups', { method: 'POST', body: JSON.stringify(data) });
}

export function updateGroup(id: number, data: object) {
  return api<Group>(`/api/v1/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
