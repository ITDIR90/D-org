import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSavedLogin, login, saveLoginCredentials } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo/Logo';

const saved = loadSavedLogin();

export function LoginPage() {
  const [nickname, setNickname] = useState(saved.nickname || 'superadmin');
  const [password, setPassword] = useState(saved.password || 'admin12345');
  const [remember, setRemember] = useState(saved.remember);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(nickname.trim(), password);
      saveLoginCredentials(nickname.trim(), password, remember);
      const ok = await refresh();
      if (!ok) {
        setError('Не удалось загрузить профиль после входа. Проверьте VITE_API_URL и пересоберите frontend.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orbit login-bg-orbit--1" />
      <div className="login-bg-orbit login-bg-orbit--2" />
      <div className="login-card">
        <div className="login-brand">
          <Logo variant="full" size={52} layout="stacked" animated />
          <p className="login-tagline">единый центр задач, проектов и коммуникаций</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Ник</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="username"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Запомнить пароль</span>
          </label>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Вход...' : 'Войти в систему'}
          </button>
        </form>
        <p className="login-footer">D-органайзер · рабочий инструмент для команд</p>
      </div>
    </div>
  );
}
