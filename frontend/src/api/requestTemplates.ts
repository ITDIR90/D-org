import { api } from './client';

export interface RequestTemplate {
  id: number;
  name: string;
  title: string;
  description: string | null;
  target_group_id: number;
  category_id: number;
  default_assignee_id: number | null;
  priority: string;
  is_active: boolean;
  sort_order: number;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  group_name?: string | null;
  category_name?: string | null;
}

export function listRequestTemplates(includeInactive = false) {
  const q = includeInactive ? '?include_inactive=true' : '';
  return api<RequestTemplate[]>(`/api/v1/request-templates${q}`);
}

export function createRequestTemplate(data: object) {
  return api<RequestTemplate>('/api/v1/request-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRequestTemplate(id: number, data: object) {
  return api<RequestTemplate>(`/api/v1/request-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function activateRequestTemplate(id: number) {
  return api<RequestTemplate>(`/api/v1/request-templates/${id}/activate`, { method: 'POST' });
}

export function deactivateRequestTemplate(id: number) {
  return api<RequestTemplate>(`/api/v1/request-templates/${id}/deactivate`, { method: 'POST' });
}
