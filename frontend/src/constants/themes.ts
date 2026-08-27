export type UiTheme = 'light' | 'dark' | 'neon' | 'matrix';

export const UI_THEMES: { id: UiTheme; label: string; description: string }[] = [
  { id: 'light', label: 'Светлая', description: 'Классическое оформление' },
  { id: 'dark', label: 'Тёмная', description: 'Приглушённые тона, комфорт для глаз' },
  { id: 'neon', label: 'Неон', description: 'Тёмный фон с яркими акцентами' },
  { id: 'matrix', label: 'Матрица', description: 'Зелёный цифровой дождь в стиле фильма' },
];

export const DEFAULT_UI_THEME: UiTheme = 'light';

export function normalizeUiTheme(value?: string | null): UiTheme {
  if (value === 'dark' || value === 'neon' || value === 'light' || value === 'matrix') return value;
  return DEFAULT_UI_THEME;
}
