import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useState } from 'react';
import { listNotifications } from '../../api/chats';
import { LogoMark, LogoText } from '../Logo/Logo';
import { TopbarKpis } from './TopbarKpis';
import { isRequestOnly } from '../../constants/roles';

const NAV = [
  { path: '/', label: 'Дашборд', icon: '◉' },
  { path: '/infopanel', label: 'Инфопанель', icon: '📺' },
  { path: '/tasks/my', label: 'Мои задачи', icon: '☑' },
  { path: '/tasks/group', label: 'Задачи группы', icon: '▣' },
  { path: '/projects', label: 'Проекты', icon: '▤' },
  { path: '/recurring', label: 'Регулярные задачи', icon: '↻' },
  { path: '/chats/group', label: 'Чат группы', icon: '💬' },
  { path: '/chats/direct', label: 'Личные сообщения', icon: '✉' },
  { path: '/users', label: 'Пользователи', icon: '👤', roles: ['superadmin', 'group_admin'] },
  { path: '/groups', label: 'Группы', icon: '⬡', roles: ['superadmin'] },
  { path: '/categories', label: 'Категории', icon: '▦', roles: ['superadmin', 'group_admin'] },
  { path: '/reports/efficiency', label: 'Эффективность', icon: '📊', roles: ['superadmin', 'group_admin'] },
  { path: '/logs', label: 'Журнал действий', icon: '📋', roles: ['superadmin'] },
  { path: '/settings', label: 'Настройки системы', icon: '⚙', roles: ['superadmin'] },
];

const REQUESTER_NAV = [
  { path: '/', label: 'Главная', icon: '◉' },
  { path: '/tasks/my', label: 'Мои заявки', icon: '☑' },
  { path: '/tasks/new', label: 'Новая заявка', icon: '＋' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const requester = isRequestOnly(user?.role);

  useEffect(() => {
    listNotifications().then((n) => setUnread(n.filter((x) => !x.is_read).length)).catch(() => {});
  }, [location.pathname]);

  const visibleNav = requester
    ? REQUESTER_NAV
    : NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className={`app-layout${requester ? ' app-layout--requester' : ''}`}>
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          <span /><span /><span />
        </button>
        <div className="topbar-brand">
          <LogoMark size={32} variant="light" />
          <LogoText variant="short" />
        </div>
        <TopbarKpis />
        <div className="topbar-right">
          <Link to="/notifications" className="notif-link" title="Уведомления">
            <span className="notif-icon">🔔</span>
            {unread > 0 && <span className="notif-count">{unread}</span>}
          </Link>
          <Link
            to="/profile"
            className={`user-chip user-chip--link${location.pathname === '/profile' ? ' user-chip--active' : ''}`}
            title="Настройки профиля"
          >
            <span className="user-avatar">{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
            <span className="user-name">{user?.full_name}</span>
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Выход</button>
        </div>
      </header>
      <div className="body-wrap">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <LogoMark size={44} variant="light" animated />
          </div>
          <nav className="sidebar-nav">
            {visibleNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={isActive(item.path) ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
