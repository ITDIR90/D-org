import { api } from './client';

export interface ChatMessage {
  id: number;
  text: string;
  author_id?: number;
  sender_id?: number;
  author_name?: string;
  sender_name?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function listChatContacts() {
  return api<{ id: number; full_name: string }[]>('/api/v1/chats/contacts');
}

export interface DirectThread {
  user_id: number;
  full_name: string;
  last_message_text: string;
  last_message_at: string;
  last_message_is_mine: boolean;
}

export function listDirectThreads() {
  return api<DirectThread[]>('/api/v1/chats/direct/threads');
}

export function getGroupMessages(groupId: number) {
  return api<ChatMessage[]>(`/api/v1/chats/group/${groupId}/messages`);
}

export function sendGroupMessage(groupId: number, text: string) {
  return api<{ message: string; ai_corrected: boolean }>(`/api/v1/chats/group/${groupId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function getDirectMessages(userId: number) {
  return api<ChatMessage[]>(`/api/v1/chats/direct/${userId}/messages`);
}

export function sendDirectMessage(userId: number, text: string) {
  return api<{ message: string; ai_corrected: boolean }>(`/api/v1/chats/direct/${userId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
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

export function listRecurring() {
  return api('/api/v1/recurring-tasks');
}

export function listUserActions() {
  return api('/api/v1/logs/user-actions');
}

export function clearUserActions() {
  return api('/api/v1/logs/user-actions', { method: 'DELETE' });
}
