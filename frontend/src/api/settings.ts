import { api } from './client';

export interface AiStatus {
  enabled: boolean;
  ready: boolean;
  provider: string;
  key_hint: string;
  reason?: string;
  model?: string;
}

export interface SystemSettings {
  ai_enabled: boolean;
  ai_status: AiStatus;
}

export function getSystemSettings() {
  return api<SystemSettings>('/api/v1/settings');
}

export function updateSystemSettings(data: { ai_enabled: boolean }) {
  return api<SystemSettings>('/api/v1/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
