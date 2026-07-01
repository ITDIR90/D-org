import { UI_THEMES, type UiTheme } from '../../constants/themes';

interface ThemeSelectProps {
  value: UiTheme;
  onChange: (theme: UiTheme) => void;
}

export function ThemeSelect({ value, onChange }: ThemeSelectProps) {
  return (
    <div className="theme-select">
      {UI_THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className={`theme-option${value === theme.id ? ' theme-option--active' : ''}`}
          data-theme-preview={theme.id}
          onClick={() => onChange(theme.id)}
          aria-pressed={value === theme.id}
        >
          <span className="theme-option__swatch" aria-hidden />
          <span className="theme-option__text">
            <span className="theme-option__label">{theme.label}</span>
            <span className="theme-option__hint">{theme.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
