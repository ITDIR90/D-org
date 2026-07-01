interface GroupChatSidebarProps {
  groups: { id: number; name: string }[];
  activeId: number | null;
  onSelect: (groupId: number) => void;
}

export function GroupChatSidebar({ groups, activeId, onSelect }: GroupChatSidebarProps) {
  return (
    <aside className="chat-sidebar card">
      <div className="chat-sidebar__header">
        <h2>Группы</h2>
      </div>
      <div className="chat-sidebar__body">
        {groups.length === 0 ? (
          <p className="chat-sidebar__empty">Нет доступных групп</p>
        ) : (
          <ul className="chat-thread-list">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className={`chat-thread-item chat-thread-item--contact${activeId === group.id ? ' chat-thread-item--active' : ''}`}
                  onClick={() => onSelect(group.id)}
                >
                  <span className="chat-thread-item__avatar chat-thread-item__avatar--group">
                    {group.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="chat-thread-item__main">
                    <span className="chat-thread-item__name">{group.name}</span>
                    <span className="chat-thread-item__preview">Групповой чат</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
