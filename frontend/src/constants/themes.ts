export type UiTheme = 'light' | 'dark' | 'neon';

export const UI_THEMES: { id: UiTheme; label: string; description: string }[] = [
  { id: 'light', label: 'Светлая', description: 'Классическое оформление' },
  { id: 'dark', label: 'Тёмная', description: 'Приглушённые тона, комфорт для глаз' },
  { id: 'neon', label: 'Неон', description: 'Тёмный фон с яркими акцентами' },
];

export const DEFAULT_UI_THEME: UiTheme = 'light';

export function normalizeUiTheme(value?: string | null): UiTheme {
  if (value === 'dark' || value === 'neon' || value === 'light') return value;
  return DEFAULT_UI_THEME;
}
