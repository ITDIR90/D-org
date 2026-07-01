import { useCallback, useEffect, useState } from 'react';
import { getGroupMessages, sendGroupMessage } from '../api/chats';
import { listGroups } from '../api/groups';
import { showAiNotice } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ChatComposer, ChatMessageItem, ChatPanel } from '../components/Chat/ChatMessageItem';
import { GroupChatSidebar } from '../components/Chat/GroupChatSidebar';
import { useChatScroll } from '../hooks/useChatScroll';

type GroupMessage = {
  id: number;
  text: string;
  author_id?: number;
  author_name?: string;
  created_at: string;
};

function isSameAuthor(a: GroupMessage, b: GroupMessage): boolean {
  return a.author_id === b.author_id && a.author_name === b.author_name;
}

function isCompactGroup(messages: GroupMessage[], index: number): boolean {
  if (index === 0) return false;
  return isSameAuthor(messages[index - 1], messages[index]);
}

export function GroupChatPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const { containerRef, scrollAnchor } = useChatScroll([messages, groupId]);

  useEffect(() => {
    listGroups()
      .then((g) => {
        setGroups(g);
        if (g.length) setGroupId(g[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить группы'));
  }, []);

  const load = useCallback(() => {
    if (!groupId) return;
    getGroupMessages(groupId)
      .then((data) => {
        setMessages(data);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения'));
  }, [groupId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const handleSend = async () => {
    if (!groupId || !text.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await sendGroupMessage(groupId, text);
      showAiNotice(res.ai_corrected);
      setText('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const selectedGroup = groups.find((g) => g.id === groupId);

  return (
    <div className="chat-page chat-page--group">
      <div className="page-header">
        <div>
          <h1>Чат группы</h1>
          {selectedGroup && <p className="chat-page-subtitle">{selectedGroup.name}</p>}
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="chat-layout-split">
        <div className="chat-layout-main">
          {groupId ? (
            <ChatPanel
              centered
              empty={messages.length === 0}
              messagesRef={containerRef}
              scrollAnchor={scrollAnchor}
              footer={(
                <ChatComposer
                  value={text}
                  onChange={setText}
                  onSubmit={handleSend}
                  disabled={!groupId}
                  sending={sending}
                />
              )}
            >
              {messages.map((m, index) => {
                const isOwn = m.author_id != null && m.author_id === user?.id;
                const compact = isCompactGroup(messages, index);
                return (
                  <ChatMessageItem
                    key={m.id}
                    authorName={m.author_name}
                    authorKey={m.author_id ?? m.author_name}
                    text={m.text}
                    createdAt={m.created_at}
                    isOwn={isOwn}
                    showAuthor={!isOwn && !compact}
                    compact={compact}
                  />
                );
              })}
            </ChatPanel>
          ) : (
            <div className="chat-panel card chat-panel--empty">
              <p className="chat-empty">Выберите группу справа</p>
            </div>
          )}
        </div>
        <GroupChatSidebar
          groups={groups}
          activeId={groupId}
          onSelect={setGroupId}
        />
      </div>
    </div>
  );
}
