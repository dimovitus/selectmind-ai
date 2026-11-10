import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { ConversationId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { ChatView } from '@/presentation/components/chat/ChatView';
import { popupPositionStyle, useClickOutside } from './mount';
import { DEFAULT_CHAT_POPUP_SIZE, getPopupPosition } from './positioning';
import { useKeyboardIsolation, usePopupDrag, useResizablePopup } from './popup-hooks';
import { FREE_CHAT_ACTION, FREE_CHAT_INPUT_PLACEHOLDER } from '@/shared/constants/free-chat';
import { extractPageContext } from '@/content/page-context-extractor';
import type { SelectionRect } from '../selection-rect';
import chatStyles from '@/presentation/components/chat/chat.css?inline';

const queryClient = new QueryClient();

interface ChatPopupProps {
  action: Action;
  conversationId: ConversationId;
  rect: SelectionRect;
  hideInitialUserMessage?: boolean;
  onClose: () => void;
  onOpenWorkspace: () => void;
}

function ChatPopupInner({
  action,
  conversationId,
  rect,
  hideInitialUserMessage,
  onClose,
  onOpenWorkspace,
}: ChatPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, { graceMs: 400 });
  useKeyboardIsolation(ref);
  const { size, resizing, onResizeStart } = useResizablePopup(ref, {
    defaultWidth: DEFAULT_CHAT_POPUP_SIZE.width,
    defaultHeight: DEFAULT_CHAT_POPUP_SIZE.height,
    minWidth: 380,
    minHeight: 320,
    storageKey: 'saywa_chat_popup_v2',
  });
  const initialPosition = useMemo(
    () =>
      getPopupPosition(rect, DEFAULT_CHAT_POPUP_SIZE.width, DEFAULT_CHAT_POPUP_SIZE.height),
    [rect],
  );
  const { position, dragging, onHeaderMouseDown } = usePopupDrag(ref, initialPosition);

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
      style={popupPositionStyle(rect, position, size)}
      className={`saywa-chat-popup${dragging ? ' saywa-popup-dragging' : ''}${
        resizing ? ' saywa-popup-resizing' : ''
      }`}
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
        <ChatView
          conversationId={conversationId}
          compact
          resolvePageContext={() => extractPageContext()}
          hideInitialUserMessage={hideInitialUserMessage}
          inputPlaceholder={
            action.id === FREE_CHAT_ACTION.id ? FREE_CHAT_INPUT_PLACEHOLDER : undefined
          }
        />
      </div>
      <div
        className="saywa-popup-resize-handle"
        title="Drag to resize"
        onPointerDown={onResizeStart}
      />
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
