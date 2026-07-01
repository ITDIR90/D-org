export const ROLES = {
  SUPERADMIN: 'superadmin',
  GROUP_ADMIN: 'group_admin',
  USER: 'user',
  REQUEST_ONLY: 'request_only',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Супер-админ',
  group_admin: 'Админ группы',
  user: 'Пользователь',
  request_only: 'Только оформление заявок',
};

export function isRequestOnly(role?: string | null): boolean {
  return role === ROLES.REQUEST_ONLY;
}

export const REQUESTER_FORBIDDEN_PREFIXES = [
  '/tasks/group',
  '/projects',
  '/recurring',
  '/chats',
  '/users',
  '/groups',
  '/categories',
  '/logs',
];

export function isRequesterForbiddenPath(pathname: string): boolean {
  return REQUESTER_FORBIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
