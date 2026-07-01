const CHAT_USER_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#dc2626',
  '#4f46e5',
  '#0d9488',
  '#ca8a04',
];

export function getChatUserColor(key: string | number): string {
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHAT_USER_COLORS[Math.abs(hash) % CHAT_USER_COLORS.length];
}
