interface PasswordChangeFieldsProps {
  isSelf: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentChange: (v: string) => void;
  onNewChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function PasswordChangeFields({
  isSelf,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentChange,
  onNewChange,
  onConfirmChange,
  expanded,
  onToggle,
}: PasswordChangeFieldsProps) {
  return (
    <div className="password-section">
      <button type="button" className="password-section-toggle" onClick={onToggle}>
        <span className="password-section-icon">{expanded ? '▾' : '▸'}</span>
        Сменить пароль
      </button>
      {expanded && (
        <div className="password-section-body">
          {isSelf && (
            <div className="form-group">
              <label>Текущий пароль</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => onCurrentChange(e.target.value)}
                autoComplete="current-password"
                placeholder="Введите текущий пароль"
              />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>{isSelf ? 'Новый пароль' : 'Новый пароль'}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => onNewChange(e.target.value)}
                autoComplete="new-password"
                placeholder="Минимум 6 символов"
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Подтверждение</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => onConfirmChange(e.target.value)}
                autoComplete="new-password"
                placeholder="Повторите пароль"
              />
            </div>
          </div>
          {!isSelf && (
            <p className="form-hint">Оставьте пустым, если менять пароль не нужно</p>
          )}
        </div>
      )}
    </div>
  );
}
