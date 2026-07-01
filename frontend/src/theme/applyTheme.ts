import { DEFAULT_UI_THEME, normalizeUiTheme, type UiTheme } from '../constants/themes';

const THEME_STORAGE_KEY = 'ui_theme';

export function applyUiTheme(theme: UiTheme) {
  const normalized = normalizeUiTheme(theme);
  document.documentElement.setAttribute('data-theme', normalized);
  localStorage.setItem(THEME_STORAGE_KEY, normalized);
}

export function getStoredUiTheme(): UiTheme {
  return normalizeUiTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function initUiTheme() {
  applyUiTheme(getStoredUiTheme() || DEFAULT_UI_THEME);
}
