import type { Action } from '@/domain/action/action.schema';
import type { ContextBundle } from '@/domain/conversation/conversation.schema';
import type { ProviderId } from '@/domain/shared/ids';
import {
  createMessageId,
  now,
  type ConversationId,
  type MessageId,
} from '@/domain/shared/ids';
import { buildContextSystemMessage, resolveTemplate } from '@/domain/template/template-engine';
import { aiRouter } from '@/infrastructure/ai/ai-router';
import { PushEmitter } from '@/infrastructure/messaging/rpc-client';
import type { ConversationRepositoryPort } from '@/infrastructure/storage/repositories/conversation.repository';
import type { MessageRepositoryPort } from '@/infrastructure/storage/repositories/conversation.repository';
import type { ProviderRepositoryPort } from '@/infrastructure/storage/repositories/settings.repository';
import type { SettingsRepository } from '@/infrastructure/storage/repositories/settings.repository';

export interface StreamConversationParams {
  conversationId: ConversationId;
  contextBundle: ContextBundle;
  action?: Action;
  providerId?: ProviderId;
  model?: string;
  temperature?: number;
}

export class StreamConversationUseCase {
  private pushEmitter = new PushEmitter();

  constructor(
    private conversationRepo: ConversationRepositoryPort,
    private messageRepo: MessageRepositoryPort,
    private providerRepo: ProviderRepositoryPort,
    private settingsRepo: SettingsRepository,
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

    const settings = await this.settingsRepo.get();
    const providerId =
      overrideProviderId ?? action?.providerId ?? settings.defaultProviderId;
    const model = overrideModel ?? action?.model ?? settings.defaultModel ?? undefined;

    if (!providerId) {
      this.pushEmitter.emit('stream:error', {
        conversationId,
        error: 'No AI provider configured. Add one in Settings.',
      });
      throw new Error('No AI provider configured');
    }

    const provider = await this.providerRepo.getById(providerId);
    if (!provider?.enabled) {
      this.pushEmitter.emit('stream:error', {
        conversationId,
        error: `Provider "${provider?.name ?? providerId}" is not enabled.`,
      });
      throw new Error('Provider not enabled');
    }

    const history = await this.messageRepo.getByConversation(conversationId);
    const systemPrompt = buildContextSystemMessage(contextBundle, settings.responseLanguage);

    const assistantMessageId = createMessageId();
    let fullContent = '';

    try {
      for await (const chunk of aiRouter.stream(providerId, model ?? provider.defaultModel, {
        messages: aiRouter.buildMessages(
          history.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
        ),
        temperature: temperature ?? action?.temperature ?? 0.7,
      })) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          this.pushEmitter.emit('stream:chunk', {
            conversationId,
            chunk,
          });
        } else if (chunk.type === 'error') {
          this.pushEmitter.emit('stream:error', {
            conversationId,
            error: chunk.error,
          });
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

      this.pushEmitter.emit('stream:done', {
        conversationId,
        messageId: assistantMessageId,
      });

      return assistantMessageId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed';
      this.pushEmitter.emit('stream:error', { conversationId, error: message });
      throw error;
    }
  }
}

export function buildActionPrompt(action: Action, contextBundle: ContextBundle): string {
  return resolveTemplate(action.prompt, contextBundle);
}
