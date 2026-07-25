import type { PlatformPorts } from '@selectmind/core';
import {
  AIRouter,
  RunPipelineUseCase,
  StreamConversationUseCase,
} from '@selectmind/core';
import { createTauriPlatform, TauriStreamEventsAdapter } from '../platform';
import { migrateLegacyApiKeys } from '../platform/tauri-secrets.adapter';
import { initDatabase } from '../storage/sqlite/db';
import {
  SqliteActionRepository,
  SqliteCategoryRepository,
  SqliteConversationRepository,
  SqliteMessageRepository,
  SqlitePipelineRepository,
  SqliteProviderRepository,
} from '../storage/sqlite/repositories';
import { ensureDatabaseSeeded } from '../storage/seed';
import {
  registerDesktopRpcHandlers,
  resetDesktopMessaging,
  wireDesktopStreamEvents,
} from '../messaging/register-handlers';

export interface DesktopContainer {
  platform: PlatformPorts;
  streamEvents: TauriStreamEventsAdapter;
  aiRouter: AIRouter;
  actionRepo: SqliteActionRepository;
  categoryRepo: SqliteCategoryRepository;
  conversationRepo: SqliteConversationRepository;
  messageRepo: SqliteMessageRepository;
  providerRepo: SqliteProviderRepository;
  pipelineRepo: SqlitePipelineRepository;
  streamConversation: StreamConversationUseCase;
  runPipeline: RunPipelineUseCase;
}

let container: DesktopContainer | null = null;
let initPromise: Promise<DesktopContainer> | null = null;

export function createDesktopContainer(platform: PlatformPorts): DesktopContainer {
  const streamEvents = new TauriStreamEventsAdapter();
  const aiRouter = new AIRouter();
  const actionRepo = new SqliteActionRepository();
  const categoryRepo = new SqliteCategoryRepository();
  const conversationRepo = new SqliteConversationRepository();
  const messageRepo = new SqliteMessageRepository();
  const providerRepo = new SqliteProviderRepository();
  const pipelineRepo = new SqlitePipelineRepository();

  return {
    platform,
    streamEvents,
    aiRouter,
    actionRepo,
    categoryRepo,
    conversationRepo,
    messageRepo,
    providerRepo,
    pipelineRepo,
    streamConversation: new StreamConversationUseCase(
      conversationRepo,
      messageRepo,
      providerRepo,
      platform.settings,
      streamEvents,
      aiRouter,
    ),
    runPipeline: new RunPipelineUseCase(
      pipelineRepo,
      actionRepo,
      conversationRepo,
      messageRepo,
      providerRepo,
      platform.settings,
      streamEvents,
      aiRouter,
    ),
  };
}

/** Initialize SQLite, seed defaults, wire use-cases. */
export async function initDesktopApp(
  platform: PlatformPorts = createTauriPlatform(),
): Promise<DesktopContainer> {
  if (container) return container;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await initDatabase();
    const next = createDesktopContainer(platform);
    await migrateLegacyApiKeys(next.platform.secrets);
    await ensureDatabaseSeeded(next);
    registerDesktopRpcHandlers(next);
    wireDesktopStreamEvents(next);
    container = next;
    return next;
  })();

  return initPromise;
}

export function getDesktopContainer(): DesktopContainer {
  if (!container) {
    throw new Error('Desktop app not initialized — call initDesktopApp() first');
  }
  return container;
}

export function resetDesktopContainer(): void {
  container = null;
  initPromise = null;
  resetDesktopMessaging();
}
