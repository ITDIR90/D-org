import { api } from './client';

export function listRecurring() {
  return api<Record<string, unknown>[]>('/api/v1/recurring-tasks');
}