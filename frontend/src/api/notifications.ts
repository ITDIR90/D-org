import { api } from './client';

export interface NotificationChannels {
  email: { enabled: boolean; ready: boolean; reason: string | null };
  telegram: { enabled: boolean; ready: boolean; reason: string | null };
  max: { enabled: boolean; ready: boolean; reason: string | null };
}

export interface NotificationTestResult {
  channels: NotificationChannels;
  user: {
    email: string;
    notify_via_email: boolean;
    notify_via_telegram: boolean;
    notify_via_max: boolean;
    telegram_chat_id: boolean;
    max_user_id: boolean;
  };
  delivery: {
    email: boolean;
    telegram: boolean;
    max: boolean;
    skipped: string[];
  };
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
}

export function getNotificationChannels() {
  return api<NotificationChannels>('/api/v1/notifications/channels');
}

export function testNotifications() {
  return api<NotificationTestResult>('/api/v1/notifications/test', { method: 'POST' });
}

export function listNotifications() {
  return api<Notification[]>('/api/v1/notifications');
}

export function markRead(id: number) {
  return api(`/api/v1/notifications/${id}/read`, { method: 'POST' });
}

export function markAllRead() {
  return api('/api/v1/notifications/read-all', { method: 'POST' });
}
