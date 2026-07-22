import type {
  ChatMessage,
  CompletionRequest,
  StreamChunk,
} from '@/domain/provider/provider.schema';
import type { ProviderId } from '@/domain/shared/ids';
import { AppError } from '@/domain/shared/result';
import type { ResolvedProvider } from './ai-provider.port';
import { providerRegistry } from './provider-registry';

export class AIRouter {
  resolve(providerId: ProviderId, model?: string): ResolvedProvider {
    const provider = providerRegistry.get(providerId);
    if (!provider) {
      throw new AppError('PROVIDER_NOT_FOUND', `Provider not found: ${providerId}`);
    }

    const resolvedModel = model ?? provider.config.defaultModel;
    if (!resolvedModel) {
      throw new AppError('PROVIDER_ERROR', 'No model specified');
    }

    return { provider, model: resolvedModel };
  }

  async *stream(
    providerId: ProviderId,
    model: string | undefined,
    request: Omit<CompletionRequest, 'model'>,
  ): AsyncIterable<StreamChunk> {
    const { provider, model: resolvedModel } = this.resolve(providerId, model);

    yield* provider.stream({
      ...request,
      model: resolvedModel,
    });
  }

  async listModels(providerId: ProviderId) {
    const provider = providerRegistry.get(providerId);
    if (!provider) {
      throw new AppError('PROVIDER_NOT_FOUND', `Provider not found: ${providerId}`);
    }
    return provider.listModels();
  }

  buildMessages(
    history: ChatMessage[],
    systemPrompt?: string,
  ): CompletionRequest['messages'] {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...history.filter((m) => m.role !== 'system'));
    return messages;
  }
}

export const aiRouter = new AIRouter();
