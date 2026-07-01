import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSystemSettings, updateSystemSettings, type SystemSettings } from '../api/settings';
import { useAuth } from '../auth/AuthContext';
import { showToast } from '../utils/toast';

export function SystemSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        setSettings(data);
        setAiEnabled(data.ai_enabled);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await updateSystemSettings({ ai_enabled: aiEnabled });
      setSettings(data);
      setAiEnabled(data.ai_enabled);
      showToast('Настройки сохранены', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const status = settings?.ai_status;

  return (
    <div>
      <div className="page-header">
        <h1>Настройки системы</h1>
      </div>

      {loading ? (
        <p className="loading">Загрузка...</p>
      ) : (
        <div className="card system-settings-card">
          <h2>Исправление текста AI</h2>
          <p className="system-settings-hint">
            Автоматическая проверка орфографии при создании задач, заявок, комментариев и сообщений.
            Доступно только супер-администратору.
          </p>

          <label className="system-settings-toggle">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <span>Включить исправление текста с помощью AI</span>
          </label>

          {status && (
            <div className="system-settings-status">
              <div><strong>Провайдер:</strong> {status.provider}</div>
              <div><strong>Ключ:</strong> {status.key_hint === 'none' ? 'не задан' : status.key_hint}</div>
              <div><strong>Готовность:</strong> {status.ready ? 'готов к работе' : (status.reason || 'не готов')}</div>
              {status.model && <div><strong>Модель:</strong> {status.model}</div>}
            </div>
          )}

          {error && <div className="action-toast action-toast--error" style={{ marginTop: '1rem' }}>{error}</div>}

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || aiEnabled === settings?.ai_enabled}
              onClick={handleSave}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
