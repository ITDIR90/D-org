import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isRequestOnly } from '../../constants/roles';

export function TasksSectionNav() {
  const { user } = useAuth();
  const location = useLocation();
  const requester = isRequestOnly(user?.role);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'group_admin';

  const links = requester
    ? [
        { path: '/tasks/my', label: 'Мои заявки' },
        { path: '/tasks/new', label: 'Новая заявка' },
      ]
    : [
        { path: '/tasks/my', label: 'Мои задачи' },
        { path: '/tasks/group', label: 'Задачи группы' },
      ];

  if (isAdmin) {
    links.push({ path: '/tasks/templates', label: 'Шаблоны заявок' });
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <nav className="section-nav" aria-label="Раздел заявок">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`section-nav-link${isActive(link.path) ? ' active' : ''}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
