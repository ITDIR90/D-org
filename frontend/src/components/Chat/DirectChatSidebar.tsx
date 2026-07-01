import type { DirectThread } from '../../api/chats';
import { formatChatTime, getInitials, truncateText } from '../../utils/chatFormat';
import { getChatUserColor } from '../../utils/chatUserColor';

type Contact = { id: number; full_name: string };

interface DirectChatSidebarProps {
  threads: DirectThread[];
  contacts: Contact[];
  activeId: number | null;
  onSelect: (userId: number) => void;
}

export function DirectChatSidebar({ threads, contacts, activeId, onSelect }: DirectChatSidebarProps) {
  const threadIds = new Set(threads.map((t) => t.user_id));
  const newContacts = contacts.filter((c) => !threadIds.has(c.id));

  return (
    <aside className="chat-sidebar card">
      <div className="chat-sidebar__header">
        <h2>Чаты</h2>
      </div>
      <div className="chat-sidebar__body">
        {threads.length === 0 && newContacts.length === 0 ? (
          <p className="chat-sidebar__empty">Нет доступных собеседников</p>
        ) : (
          <>
            {threads.length > 0 && (
              <ul className="chat-thread-list">
                {threads.map((thread) => (
                  <li key={thread.user_id}>
                    <button
                      type="button"
                      className={`chat-thread-item${activeId === thread.user_id ? ' chat-thread-item--active' : ''}`}
                      onClick={() => onSelect(thread.user_id)}
                    >
                      <span
                        className="chat-thread-item__avatar"
                        style={{ background: getChatUserColor(thread.user_id) }}
                      >
                        {getInitials(thread.full_name)}
                      </span>
                      <span className="chat-thread-item__main">
                        <span className="chat-thread-item__name">{thread.full_name}</span>
                        <span className="chat-thread-item__preview">
                          {thread.last_message_is_mine ? 'Вы: ' : ''}
                          {truncateText(thread.last_message_text)}
                        </span>
                      </span>
                      <span className="chat-thread-item__time">
                        {formatChatTime(thread.last_message_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {newContacts.length > 0 && (
              <>
                <h3 className="chat-sidebar__section">Контакты</h3>
                <ul className="chat-thread-list">
                  {newContacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className={`chat-thread-item chat-thread-item--contact${activeId === contact.id ? ' chat-thread-item--active' : ''}`}
                        onClick={() => onSelect(contact.id)}
                      >
                        <span
                          className="chat-thread-item__avatar"
                          style={{ background: getChatUserColor(contact.id) }}
                        >
                          {getInitials(contact.full_name)}
                        </span>
                        <span className="chat-thread-item__main">
                          <span className="chat-thread-item__name">{contact.full_name}</span>
                          <span className="chat-thread-item__preview">Начать переписку</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
