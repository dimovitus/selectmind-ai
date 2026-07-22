import { create } from 'zustand';
import type { ConversationId } from '@/domain/shared/ids';

interface UIStore {
  activeConversationId: ConversationId | null;
  isCommandPaletteOpen: boolean;
  streamingContent: string;
  isStreaming: boolean;
  setActiveConversation: (id: ConversationId | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  appendStreamContent: (chunk: string) => void;
  setStreaming: (streaming: boolean) => void;
  resetStream: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeConversationId: null,
  isCommandPaletteOpen: false,
  streamingContent: '',
  isStreaming: false,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  appendStreamContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  resetStream: () => set({ streamingContent: '', isStreaming: false }),
}));
