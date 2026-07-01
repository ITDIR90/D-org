import { useEffect, useState } from 'react';
import { listNotifications, markRead, markAllRead } from '../api/chats';

export function NotificationsPage() {
  const [items, setItems] = useState<{ id: number; title: string; message: string; is_read: boolean; created_at: string }[]>([]);

  const load = () => listNotifications().then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Уведомления</h1>
        <button className="btn btn-secondary" onClick={() => markAllRead().then(load)}>Прочитать все</button>
      </div>
      {items.length === 0 ? <p className="empty">Нет уведомлений</p> : (
        <div>
          {items.map((n) => (
            <div key={n.id} className="card" style={{ opacity: n.is_read ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{n.title}</strong>
                <span style={{ fontSize: '0.75rem', color: '#718096' }}>{new Date(n.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <p style={{ marginTop: '0.5rem' }}>{n.message}</p>
              {!n.is_read && <button className="btn btn-sm btn-secondary" onClick={() => markRead(n.id).then(load)}>Прочитано</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
