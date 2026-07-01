import { api } from './client';

export interface NotificationChannels {
  email: { enabled: boolean; ready: boolean; reason: string | null };
  telegram: { enabled: boolean; ready: boolean; reason: string | null };
}

export interface NotificationTestResult {
  channels: NotificationChannels;
  user: {
    email: string;
    notify_via_email: boolean;
    notify_via_telegram: boolean;
    telegram_chat_id: boolean;
  };
  delivery: {
    email: boolean;
    telegram: boolean;
    skipped: string[];
  };
}

export function getNotificationChannels() {
  return api<NotificationChannels>('/api/v1/notifications/channels');
}

export function testNotifications() {
  return api<NotificationTestResult>('/api/v1/notifications/test', { method: 'POST' });
}
