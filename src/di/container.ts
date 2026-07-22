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
import { StreamConversationUseCase } from '@/application/stream-conversation.use-case';
import { RunPipelineUseCase } from '@/application/run-pipeline.use-case';
import { AIRouter } from '@/infrastructure/ai/ai-router';

export interface AppContainer {
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

export function createContainer(): AppContainer {
  const actionRepo = new ActionRepository();
  const categoryRepo = new CategoryRepository();
  const conversationRepo = new ConversationRepository();
  const messageRepo = new MessageRepository();
  const providerRepo = new ProviderRepository();
  const settingsRepo = new SettingsRepository();
  const pipelineRepo = new PipelineRepository();
  const aiRouter = new AIRouter();

  return {
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
      settingsRepo,
    ),
    runPipeline: new RunPipelineUseCase(
      pipelineRepo,
      actionRepo,
      conversationRepo,
      messageRepo,
      providerRepo,
      settingsRepo,
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
