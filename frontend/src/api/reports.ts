import { api, getToken } from './client';

export interface EmployeeEfficiencyRow {
  user_id: number;
  full_name: string;
  completed_count: number;
  avg_completion_hours: number | null;
  on_time_count: number;
  on_time_percent: number | null;
  avg_overdue_hours: number | null;
}

export interface EmployeeEfficiencyReport {
  period_days: number;
  group_id: number | null;
  rows: EmployeeEfficiencyRow[];
}

export function getEmployeeEfficiencyReport(params: { period_days?: number; group_id?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.period_days) qs.set('period_days', String(params.period_days));
  if (params.group_id) qs.set('group_id', String(params.group_id));
  const q = qs.toString();
  return api<EmployeeEfficiencyReport>(`/api/v1/reports/employee-efficiency${q ? `?${q}` : ''}`);
}

export interface CompletedTaskReportRow {
  task_id: number;
  number: number;
  title: string;
  completed_at: string;
  completed_day: string;
  assignee_id: number | null;
  assignee_name: string;
  author_id: number | null;
  author_name: string;
  category_id: number;
  category_name: string;
  group_id: number;
  group_name: string;
  due_at: string | null;
  priority: string | null;
}

export interface CompletedTasksMatrixCell {
  day: string;
  count: number;
  task_ids: number[];
}

export interface CompletedTaskMatrixRow {
  row_id: number;
  row_name: string;
  total: number;
  cells: CompletedTasksMatrixCell[];
}

export interface CompletedTasksReport {
  date_from: string;
  date_to: string;
  group_id: number | null;
  user_id: number | null;
  category_id: number | null;
  group_by: 'category' | 'user';
  total: number;
  days: string[];
  rows: CompletedTaskMatrixRow[];
  day_totals: number[];
  tasks: CompletedTaskReportRow[];
}

export interface CompletedTasksParams {
  date_from: string;
  date_to: string;
  group_id?: number;
  user_id?: number;
  category_id?: number;
  group_by?: 'category' | 'user';
}

function completedQuery(params: CompletedTasksParams): string {
  const qs = new URLSearchParams();
  qs.set('date_from', params.date_from);
  qs.set('date_to', params.date_to);
  if (params.group_id) qs.set('group_id', String(params.group_id));
  if (params.user_id) qs.set('user_id', String(params.user_id));
  if (params.category_id) qs.set('category_id', String(params.category_id));
  if (params.group_by) qs.set('group_by', params.group_by);
  return qs.toString();
}

export function getCompletedTasksReport(params: CompletedTasksParams) {
  return api<CompletedTasksReport>(`/api/v1/reports/completed-tasks?${completedQuery(params)}`);
}

export async function exportCompletedTasksXlsx(params: CompletedTasksParams): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/v1/reports/completed-tasks/export?${completedQuery(params)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const err = await res.json();
      message = (err && err.detail) || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1].replace(/["\\]/g, '') : 'otchet-vypolnennye-zadachi.xlsx';

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
