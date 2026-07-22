import { useRef } from 'react';
import { motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { ConversationId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { ChatView } from '@/presentation/components/chat/ChatView';
import { popupPositionStyle, useClickOutside } from './mount';
import { getPopupPosition } from './positioning';
import { useKeyboardIsolation, usePopupDrag, useResizablePopup } from './popup-hooks';
import { extractPageContext } from '@/content/page-context-extractor';
import type { SelectionRect } from '../selection-rect';
import chatStyles from '@/presentation/components/chat/chat.css?inline';

const queryClient = new QueryClient();

interface ChatPopupProps {
  action: Action;
  conversationId: ConversationId;
  rect: SelectionRect;
  onClose: () => void;
  onOpenWorkspace: () => void;
}

function ChatPopupInner({
  action,
  conversationId,
  rect,
  onClose,
  onOpenWorkspace,
}: ChatPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, { graceMs: 400 });
  useKeyboardIsolation(ref);
  useResizablePopup(ref, 440, 480);
  const { position, dragging, onHeaderMouseDown } = usePopupDrag(ref, getPopupPosition(rect));

  const handleOpenWorkspace = async () => {
    await rpcClient.call('conversation:promote', { conversationId, mode: 'chat' });
    onOpenWorkspace();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={popupPositionStyle(rect, position)}
      className={`saywa-chat-popup${dragging ? ' saywa-popup-dragging' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="saywa-chat-popup-header saywa-popup-drag-handle"
        onMouseDown={onHeaderMouseDown}
      >
        <span>{action.icon}</span>
        <span className="saywa-chat-popup-title">{action.name}</span>
        <button type="button" className="saywa-chat-popup-expand" onClick={() => void handleOpenWorkspace()}>
          ⤢
        </button>
        <button type="button" className="saywa-chat-popup-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="saywa-chat-popup-body">
        <ChatView conversationId={conversationId} compact resolvePageContext={() => extractPageContext()} />
      </div>
    </motion.div>
  );
}

export function ChatPopup(props: ChatPopupProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatPopupInner {...props} />
    </QueryClientProvider>
  );
}

export { chatStyles };
