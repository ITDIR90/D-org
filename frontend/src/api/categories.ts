import { api } from './client';

export interface Category {
  id: number;
  group_id: number;
  name: string;
  default_due_days?: number;
  requires_author_confirmation: boolean;
  is_active: boolean;
}

export function listCategories(groupId?: number) {
  const q = groupId ? `?group_id=${groupId}` : '';
  return api<Category[]>(`/api/v1/categories${q}`);
}

export function createCategory(data: object) {
  return api<Category>('/api/v1/categories', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCategory(id: number, data: object) {
  return api<Category>(`/api/v1/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
