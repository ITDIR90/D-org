import { api } from './client';

export interface Project {
  id: number;
  title: string;
  description?: string;
  group_id: number;
  author_id: number;
  responsible_id?: number;
  due_at?: string;
  priority: string;
  status: string;
  spent_hours?: number;
  author_name?: string;
}

export interface Subtask {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  assignee_id?: number;
  assignee_name?: string;
  due_at?: string;
  priority: string;
  status: string;
  spent_hours?: number;
}

export function listProjects() {
  return api<Project[]>('/api/v1/projects');
}

export function getProject(id: number) {
  return api<Project>(`/api/v1/projects/${id}`);
}

export function createProject(data: object) {
  return api<{ message: string; ai_corrected: boolean }>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listSubtasks(projectId: number) {
  return api<Subtask[]>(`/api/v1/projects/${projectId}/subtasks`);
}

export function createSubtask(projectId: number, data: object) {
  return api<{ message: string; ai_corrected: boolean }>(`/api/v1/projects/${projectId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function subtaskAction(id: number, action: string) {
  return api<Subtask>(`/api/v1/project-subtasks/${id}/${action}`, { method: 'POST' });
}
