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

const queryClient = new QueryClient();

interface QuickActionPopupProps {
  action: Action;
  conversationId: ConversationId;
  rect: SelectionRect;
  onClose: () => void;
  onContinueChat: () => void;
}

function QuickActionPopupInner({
  action,
  conversationId,
  rect,
  onClose,
  onContinueChat,
}: QuickActionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, { graceMs: 400 });
  useKeyboardIsolation(ref);
  useResizablePopup(ref);
  const { position, dragging, onHeaderMouseDown } = usePopupDrag(ref, getPopupPosition(rect));

  const handleOpenSidePanel = async () => {
    await rpcClient.call('conversation:promote', { conversationId, mode: 'chat' });
    onContinueChat();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={popupPositionStyle(rect, position)}
      className={`saywa-popup saywa-popup-chat${dragging ? ' saywa-popup-dragging' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="saywa-popup-header saywa-popup-drag-handle" onMouseDown={onHeaderMouseDown}>
        <span className="saywa-popup-icon">{action.icon}</span>
        <span className="saywa-popup-title">{action.name}</span>
        <button
          type="button"
          className="saywa-popup-expand"
          onClick={() => void handleOpenSidePanel()}
          title="Open in side panel"
        >
          ⤢
        </button>
        <button type="button" className="saywa-popup-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="saywa-popup-body saywa-popup-chat-body">
        <ChatView
          conversationId={conversationId}
          compact
          hideInitialUserMessage
          resolvePageContext={() => extractPageContext()}
        />
      </div>
    </motion.div>
  );
}

export function QuickActionPopup(props: QuickActionPopupProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuickActionPopupInner {...props} />
    </QueryClientProvider>
  );
}
