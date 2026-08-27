import type {
  CompletionRequest,
  ModelInfo,
  ProviderConfig,
  StreamChunk,
} from '../../domain/provider/provider.schema';
import type { ProviderId } from '../../domain/shared/ids';
import { ok, err, type Result } from '../../domain/shared/result';
import { AppError } from '../../domain/shared/result';
import type { AIProviderPort } from '../ai-provider.port';
import {
  extractAnthropicDelta,
  parseSSEStream,
  readErrorBody,
} from '../streaming/sse-parser';

const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements AIProviderPort {
  constructor(
    readonly config: ProviderConfig,
    private apiKey: string,
  ) {}

  get id(): ProviderId {
    return this.config.id;
  }

  async validateConfig(): Promise<Result<void>> {
    if (!this.apiKey) {
      return err(new AppError('PROVIDER_ERROR', 'API key is required'));
    }
    return ok(undefined);
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerId: this.config.id, supportsVision: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', providerId: this.config.id, supportsVision: false },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: this.config.id, supportsVision: true },
    ];
  }

  async complete(request: CompletionRequest): Promise<string> {
    let result = '';
    for await (const chunk of this.stream(request)) {
      if (chunk.type === 'text') result += chunk.content;
      if (chunk.type === 'error') throw new Error(chunk.error);
    }
    return result;
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const validation = await this.validateConfig();
    if (!validation.ok) {
      yield { type: 'error', error: validation.error.message };
      return;
    }

    const systemMessage = request.systemPrompt ??
      request.messages.find((m) => m.role === 'system')?.content;
    const messages = request.messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: systemMessage,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: await readErrorBody(response) };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    for await (const { event, data } of parseSSEStream(response.body)) {
      const delta = extractAnthropicDelta(event, data);
      if (delta) {
        yield { type: 'text', content: delta };
      }
    }

    yield { type: 'done' };
  }
}
