import type { Action } from '../domain/action/action.schema';
import type { ContextBundle } from '../domain/conversation/conversation.schema';
import type { ProviderId } from '../domain/shared/ids';
import {
  createMessageId,
  now,
  type ConversationId,
  type MessageId,
} from '../domain/shared/ids';
import { buildContextSystemMessage, resolveTemplate } from '../domain/template/template-engine';
import type { AIRouter } from '../ai/ai-router';
import type {
  ConversationRepositoryPort,
  MessageRepositoryPort,
  ProviderRepositoryPort,
} from '../ports/repositories.port';
import type { SettingsPort } from '../ports/settings.port';
import type { StreamEventsPort } from '../ports/stream-events.port';

export interface StreamConversationParams {
  conversationId: ConversationId;
  contextBundle: ContextBundle;
  action?: Action;
  providerId?: ProviderId;
  model?: string;
  temperature?: number;
}

export class StreamConversationUseCase {
  constructor(
    private conversationRepo: ConversationRepositoryPort,
    private messageRepo: MessageRepositoryPort,
    private providerRepo: ProviderRepositoryPort,
    private settings: SettingsPort,
    private streamEvents: StreamEventsPort,
    private aiRouter: AIRouter,
  ) {}

  async execute(params: StreamConversationParams): Promise<MessageId> {
    const {
      conversationId,
      contextBundle,
      action,
      providerId: overrideProviderId,
      model: overrideModel,
      temperature,
    } = params;

    const settings = await this.settings.get();
    const providerId =
      overrideProviderId ?? action?.providerId ?? settings.defaultProviderId;
    const model = overrideModel ?? action?.model ?? settings.defaultModel ?? undefined;

    if (!providerId) {
      this.streamEvents.emitStreamError(
        conversationId,
        'No AI provider configured. Add one in Settings.',
      );
      throw new Error('No AI provider configured');
    }

    const provider = await this.providerRepo.getById(providerId);
    if (!provider?.enabled) {
      this.streamEvents.emitStreamError(
        conversationId,
        `Provider "${provider?.name ?? providerId}" is not enabled.`,
      );
      throw new Error('Provider not enabled');
    }

    const history = await this.messageRepo.getByConversation(conversationId);
    const systemPrompt = buildContextSystemMessage(contextBundle, settings.responseLanguage);
    const images = contextBundle.screenshot?.dataUrl ? [contextBundle.screenshot.dataUrl] : undefined;

    const assistantMessageId = createMessageId();
    let fullContent = '';

    try {
      for await (const chunk of this.aiRouter.stream(providerId, model ?? provider.defaultModel, {
        messages: this.aiRouter.buildMessages(
          history.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
        ),
        images,
        temperature: temperature ?? action?.temperature ?? 0.7,
      })) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          this.streamEvents.emitStreamChunk(conversationId, chunk);
        } else if (chunk.type === 'error') {
          this.streamEvents.emitStreamError(conversationId, chunk.error);
          throw new Error(chunk.error);
        } else if (chunk.type === 'done') {
          break;
        }
      }

      const timestamp = now();
      await this.messageRepo.save({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: fullContent,
        providerId,
        model: model ?? provider.defaultModel,
        tokenUsage: undefined,
        createdAt: timestamp,
      });

      const conversation = await this.conversationRepo.getById(conversationId);
      if (conversation) {
        await this.conversationRepo.save({
          ...conversation,
          updatedAt: timestamp,
        });
      }

      this.streamEvents.emitStreamDone(conversationId, assistantMessageId);

      return assistantMessageId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed';
      this.streamEvents.emitStreamError(conversationId, message);
      throw error;
    }
  }
}

export function buildActionPrompt(action: Action, contextBundle: ContextBundle): string {
  return resolveTemplate(action.prompt, contextBundle);
}
