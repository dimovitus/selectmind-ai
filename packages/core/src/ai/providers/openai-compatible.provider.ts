import type { AIProviderPort } from '../ai-provider.port';
import type {
  ChatMessage,
  CompletionRequest,
  ModelInfo,
  ProviderConfig,
  StreamChunk,
} from '../../domain/provider/provider.schema';
import type { ProviderId } from '../../domain/shared/ids';
import { ok, err, type Result } from '../../domain/shared/result';
import { AppError } from '../../domain/shared/result';
import {
  extractOpenAIDelta,
  parseSSEStream,
  readErrorBody,
} from '../streaming/sse-parser';

export class OpenAICompatibleProvider implements AIProviderPort {
  constructor(
    readonly config: ProviderConfig,
    private apiKey: string,
  ) {}

  get id(): ProviderId {
    return this.config.id;
  }

  get baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async validateConfig(): Promise<Result<void>> {
    if (!this.apiKey && this.config.type === 'cloud') {
      return err(new AppError('PROVIDER_ERROR', 'API key is required'));
    }
    return ok(undefined);
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }

    const data = (await response.json()) as {
      data?: { id: string }[];
    };

    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      providerId: this.config.id,
      supportsVision: false,
    }));
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

    const messages = this.buildMessages(request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: this.toApiMessages(messages, request.images),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
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

    let usage: { prompt: number; completion: number; total: number } | undefined;

    for await (const { data } of parseSSEStream(response.body)) {
      if (data === '[DONE]') break;

      const delta = extractOpenAIDelta(data);
      if (delta) {
        yield { type: 'text', content: delta };
      }

      try {
        const parsed = JSON.parse(data) as {
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };
        if (parsed.usage) {
          usage = {
            prompt: parsed.usage.prompt_tokens,
            completion: parsed.usage.completion_tokens,
            total: parsed.usage.total_tokens,
          };
        }
      } catch {
        // ignore partial JSON
      }
    }

    yield { type: 'done', usage };
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = this.apiKey || (this.config.type === 'local' ? 'ollama' : '');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  protected buildMessages(request: CompletionRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push(...request.messages);
    return messages;
  }

  protected toApiMessages(
    messages: ChatMessage[],
    images?: string[],
  ): Array<{ role: ChatMessage['role']; content: unknown }> {
    if (!images?.length) {
      return messages.map((m) => ({ role: m.role, content: m.content }));
    }

    const apiMessages = messages.map((m) => ({ role: m.role, content: m.content as unknown }));
    for (let i = apiMessages.length - 1; i >= 0; i--) {
      const message = apiMessages[i];
      if (!message || message.role !== 'user') continue;
      const text = String(message.content ?? '');
      message.content = [
        { type: 'text', text },
        ...images.map((url) => ({
          type: 'image_url',
          image_url: { url, detail: 'high' },
        })),
      ];
      break;
    }
    return apiMessages;
  }
}
