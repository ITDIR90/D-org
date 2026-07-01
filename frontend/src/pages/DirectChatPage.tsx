import { useCallback, useEffect, useState } from 'react';
import { getDirectMessages, listChatContacts, listDirectThreads, sendDirectMessage } from '../api/chats';
import type { DirectThread } from '../api/chats';
import { showAiNotice } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DirectChatSidebar } from '../components/Chat/DirectChatSidebar';
import { ChatComposer, ChatMessageItem, ChatPanel } from '../components/Chat/ChatMessageItem';
import { useChatScroll } from '../hooks/useChatScroll';

type DirectMessage = {
  id: number;
  text: string;
  sender_id?: number;
  sender_name?: string;
  created_at: string;
};

type Contact = { id: number; full_name: string };

function pickInitialChatId(threads: DirectThread[], contacts: Contact[]): number | null {
  if (threads.length) return threads[0].user_id;
  if (contacts.length) return contacts[0].id;
  return null;
}

export function DirectChatPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [otherId, setOtherId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const { containerRef, scrollAnchor } = useChatScroll([messages, otherId]);

  const loadSidebar = useCallback(() => {
    Promise.all([listDirectThreads(), listChatContacts()])
      .then(([threadList, contactList]) => {
        setThreads(threadList);
        setContacts(contactList);
        setOtherId((current) => current ?? pickInitialChatId(threadList, contactList));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить чаты'));
  }, []);

  useEffect(() => {
    loadSidebar();
    const t = setInterval(loadSidebar, 10000);
    return () => clearInterval(t);
  }, [loadSidebar]);

  const loadMessages = useCallback(() => {
    if (!otherId) return;
    getDirectMessages(otherId)
      .then((data) => {
        setMessages(data);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения'));
  }, [otherId]);

  useEffect(() => {
    loadMessages();
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!otherId || !text.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await sendDirectMessage(otherId, text);
      showAiNotice(res.ai_corrected);
      setText('');
      loadMessages();
      loadSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const selectedUser =
    threads.find((t) => t.user_id === otherId)
    ?? contacts.find((c) => c.id === otherId);

  return (
    <div className="chat-page">
      <div className="page-header">
        <div>
          <h1>Личные сообщения</h1>
          {selectedUser && (
            <p className="chat-page-subtitle">{selectedUser.full_name}</p>
          )}
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="chat-layout-split">
        <div className="chat-layout-main">
          {otherId ? (
            <ChatPanel
              empty={messages.length === 0}
              messagesRef={containerRef}
              scrollAnchor={scrollAnchor}
              footer={(
                <ChatComposer
                  value={text}
                  onChange={setText}
                  onSubmit={handleSend}
                  disabled={!otherId}
                  sending={sending}
                />
              )}
            >
              {messages.map((m, index) => {
                const isOwn = m.sender_id != null && m.sender_id === user?.id;
                const prev = messages[index - 1];
                const compact = index > 0 && prev.sender_id === m.sender_id;
                return (
                  <ChatMessageItem
                    key={m.id}
                    authorName={m.sender_name}
                    authorKey={m.sender_id ?? m.sender_name}
                    text={m.text}
                    createdAt={m.created_at}
                    isOwn={isOwn}
                    showAuthor={false}
                    compact={compact}
                  />
                );
              })}
            </ChatPanel>
          ) : (
            <div className="chat-panel card chat-panel--empty">
              <p className="chat-empty">Выберите чат справа</p>
            </div>
          )}
        </div>
        <DirectChatSidebar
          threads={threads}
          contacts={contacts}
          activeId={otherId}
          onSelect={setOtherId}
        />
      </div>
    </div>
  );
}
