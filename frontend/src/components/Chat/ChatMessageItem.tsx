import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { getChatUserColor } from '../../utils/chatUserColor';
import { formatChatTime, getInitials } from '../../utils/chatFormat';

interface ChatMessageItemProps {
  authorName?: string;
  authorKey?: string | number;
  text: string;
  createdAt: string;
  isOwn?: boolean;
  showAuthor?: boolean;
  compact?: boolean;
}

export function ChatMessageItem({
  authorName,
  authorKey,
  text,
  createdAt,
  isOwn = false,
  showAuthor = true,
  compact = false,
}: ChatMessageItemProps) {
  const color = getChatUserColor(authorKey ?? authorName ?? 'unknown');
  const style = { '--chat-user-color': color } as CSSProperties;
  const displayName = isOwn ? 'Вы' : (authorName || 'Неизвестный');

  return (
    <div
      className={[
        'chat-msg-row',
        isOwn ? 'chat-msg-row--own' : 'chat-msg-row--other',
        compact ? 'chat-msg-row--compact' : '',
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {!isOwn && !compact && (
        <div className="chat-msg-avatar" title={authorName}>
          {getInitials(authorName)}
        </div>
      )}
      <div className="chat-msg-body">
        {!isOwn && showAuthor && (
          <div className="chat-msg-author">{displayName}</div>
        )}
        <div className={`chat-msg-bubble${isOwn ? ' chat-msg-bubble--own' : ''}`}>
          <div className="chat-msg-text">{text}</div>
          <div className="chat-msg-time">{formatChatTime(createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  sending,
  placeholder = 'Сообщение...',
}: ChatComposerProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled || sending) return;
    void onSubmit();
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <input
        className="chat-composer__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || sending}
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary chat-composer__send" disabled={disabled || sending || !value.trim()}>
        {sending ? '…' : 'Отправить'}
      </button>
    </form>
  );
}

interface ChatPanelProps {
  children: ReactNode;
  footer: ReactNode;
  empty?: boolean;
  emptyText?: string;
  messagesRef: React.Ref<HTMLDivElement>;
  scrollAnchor: React.Ref<HTMLDivElement>;
  centered?: boolean;
}

export function ChatPanel({
  children,
  footer,
  empty,
  emptyText = 'Сообщений пока нет. Напишите первым.',
  messagesRef,
  scrollAnchor,
  centered = false,
}: ChatPanelProps) {
  return (
    <div className={`chat-panel card${centered ? ' chat-panel--centered' : ''}`}>
      <div className="chat-messages" ref={messagesRef}>
        {empty ? (
          <p className="chat-empty">{emptyText}</p>
        ) : (
          <div className={`chat-messages-inner${centered ? ' chat-messages-inner--centered' : ''}`}>
            {children}
            <div ref={scrollAnchor} className="chat-scroll-anchor" aria-hidden />
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
