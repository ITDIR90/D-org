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

export function listChatContacts() {
  return api<{ id: number; full_name: string }[]>('/api/v1/chats/contacts');
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
