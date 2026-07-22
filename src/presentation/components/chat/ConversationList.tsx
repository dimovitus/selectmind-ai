import type { Conversation } from '@/domain/conversation/conversation.schema';
import type { ConversationId } from '@/domain/shared/ids';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: ConversationId | null;
  onSelect: (id: ConversationId) => void;
  onNew?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getPreview(conversation: Conversation): string {
  if (conversation.contextBundle.selection) {
    return conversation.contextBundle.selection.slice(0, 80);
  }
  if (conversation.contextBundle.pageTitle) {
    return conversation.contextBundle.pageTitle;
  }
  return 'New conversation';
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="sw-conv-list-empty">
        <p>No conversations yet</p>
        {onNew && (
          <button type="button" className="sw-conv-list-new" onClick={onNew}>
            Start new
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sw-conv-list">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          type="button"
          className={`sw-conv-item ${activeId === conv.id ? 'sw-conv-item-active' : ''}`}
          onClick={() => onSelect(conv.id)}
        >
          <div className="sw-conv-item-preview">{getPreview(conv)}</div>
          <div className="sw-conv-item-meta">
            <span className={`sw-conv-mode sw-conv-mode-${conv.mode}`}>{conv.mode}</span>
            <span>{formatRelativeTime(conv.updatedAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
