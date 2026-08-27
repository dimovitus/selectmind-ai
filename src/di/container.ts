import type { PlatformPorts } from '@selectmind/core';
import {
  AIRouter,
  RunPipelineUseCase,
  StreamConversationUseCase,
} from '@selectmind/core';
import { ActionRepository, CategoryRepository } from '@/infrastructure/storage/repositories/action.repository';
import {
  ConversationRepository,
  MessageRepository,
} from '@/infrastructure/storage/repositories/conversation.repository';
import {
  ProviderRepository,
  SettingsRepository,
} from '@/infrastructure/storage/repositories/settings.repository';
import { RpcServer } from '@/infrastructure/messaging/rpc-client';
import { PipelineRepository } from '@/infrastructure/storage/repositories/pipeline.repository';
import { ChromeStreamEventsAdapter } from '@/platform/extension/chrome-stream-events.adapter';
import { createExtensionPlatform } from '@/platform/extension';

export interface AppContainer {
  platform: PlatformPorts;
  actionRepo: ActionRepository;
  categoryRepo: CategoryRepository;
  conversationRepo: ConversationRepository;
  messageRepo: MessageRepository;
  providerRepo: ProviderRepository;
  settingsRepo: SettingsRepository;
  pipelineRepo: PipelineRepository;
  rpcServer: RpcServer;
  streamConversation: StreamConversationUseCase;
  runPipeline: RunPipelineUseCase;
  aiRouter: AIRouter;
}

let container: AppContainer | null = null;

export function createContainer(platform: PlatformPorts = createExtensionPlatform()): AppContainer {
  const actionRepo = new ActionRepository();
  const categoryRepo = new CategoryRepository();
  const conversationRepo = new ConversationRepository();
  const messageRepo = new MessageRepository();
  const providerRepo = new ProviderRepository();
  const settingsRepo = new SettingsRepository(platform.settings);
  const pipelineRepo = new PipelineRepository();
  const aiRouter = new AIRouter();
  const streamEvents = new ChromeStreamEventsAdapter();

  return {
    platform,
    actionRepo,
    categoryRepo,
    conversationRepo,
    messageRepo,
    providerRepo,
    settingsRepo,
    pipelineRepo,
    rpcServer: new RpcServer(),
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
    aiRouter,
  };
}

export function getContainer(): AppContainer {
  if (!container) {
    container = createContainer();
  }
  return container;
}

export function resetContainer(): void {
  container = null;
}
