import type { Message } from '@/domain/conversation/conversation.schema';
import { MarkdownRenderer } from '@/presentation/components/markdown/MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  showFullUserMessage?: boolean;
}

export function MessageBubble({ message, showFullUserMessage }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) return null;

  const userContent =
    showFullUserMessage || message.content.length <= 500
      ? message.content
      : `${message.content.slice(0, 500)}…`;

  return (
    <div className={`sw-message ${isUser ? 'sw-message-user' : 'sw-message-assistant'}`}>
      <div className="sw-message-role">{isUser ? 'You' : 'AI'}</div>
      <div className="sw-message-content">
        {isUser ? <p>{userContent}</p> : <MarkdownRenderer content={message.content} />}
      </div>
    </div>
  );
}
