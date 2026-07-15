import { api, setToken } from './client';

const REMEMBER_KEY = 'remember_login';
const SAVED_NICKNAME_KEY = 'saved_nickname';
const SAVED_PASSWORD_KEY = 'saved_password';

export interface User {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  nickname: string;
  timezone: string;
  ui_theme?: string;
  email: string;
  role: string;
  is_active: boolean;
  member_group_ids: number[];
  admin_group_ids: number[];
  task_target_group_ids: number[];
  full_name: string;
  notify_via_email?: boolean;
  notify_via_telegram?: boolean;
  notify_via_max?: boolean;
  telegram_chat_id?: string | null;
  max_user_id?: number | null;
  printer?: string | null;
}

export interface SavedLogin {
  nickname: string;
  password: string;
  remember: boolean;
}

export function loadSavedLogin(): SavedLogin {
  const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
  return {
    remember,
    nickname: remember ? localStorage.getItem(SAVED_NICKNAME_KEY) || '' : '',
    password: remember ? localStorage.getItem(SAVED_PASSWORD_KEY) || '' : '',
  };
}

export function saveLoginCredentials(nickname: string, password: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, 'true');
    localStorage.setItem(SAVED_NICKNAME_KEY, nickname);
    localStorage.setItem(SAVED_PASSWORD_KEY, password);
    return;
  }
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(SAVED_NICKNAME_KEY);
  localStorage.removeItem(SAVED_PASSWORD_KEY);
}

export async function login(nickname: string, password: string) {
  const data = await api<{ access_token: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nickname, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function logout() {
  await api('/api/v1/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<User> {
  return api<User>('/api/v1/auth/me');
}

export async function changePassword(current: string, newPass: string) {
  return api('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: current, new_password: newPass }),
  });
}
