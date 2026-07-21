import { api } from './client';

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
