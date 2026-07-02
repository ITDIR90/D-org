function normalizeApiBaseUrl(raw: string): string {
  const configured = raw.trim().replace(/\/$/, '');
  if (!configured) return '';

  try {
    const apiUrl = new URL(configured, window.location.origin);
    const pageHost = window.location.hostname;
    const apiHost = apiUrl.hostname;

    // Частая ошибка деплоя: в .env остался localhost:8000 из dev-сборки.
    if ((apiHost === 'localhost' || apiHost === '127.0.0.1') && pageHost !== apiHost) {
      return '';
    }

    // В Docker prod API доступен через Nginx на том же хосте (порт 80/443).
    if (apiHost === pageHost && apiUrl.port && apiUrl.port !== window.location.port) {
      return '';
    }

    return configured;
  } catch {
    return '';
  }
}

const API_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || '');

export interface ApiError {
  detail: string;
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

function parseErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return 'Ошибка запроса';
      })
      .join('; ');
  }
  return 'Ошибка запроса';
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Не удалось подключиться к серверу. Проверьте, что backend запущен.');
  }

  if (res.status === 401) {
    clearToken();
    const err = await res.json().catch(() => ({ detail: 'Требуется авторизация' }));
    const message = parseErrorDetail(err.detail);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error(message);
  }

  if (!res.ok) {
    const text = await res.text();
    let message = `Ошибка ${res.status}`;
    try {
      const err = JSON.parse(text) as { detail?: unknown };
      message = parseErrorDetail(err.detail) || message;
    } catch {
      if (text.includes('502 Bad Gateway')) {
        message = 'Сервер API недоступен (502). Проверьте контейнер backend.';
      } else if (text.trim()) {
        message = `${message}: ${text.replace(/<[^>]+>/g, ' ').slice(0, 120).trim()}`;
      }
    }
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export { showAiNotice, showToast } from '../utils/toast';
