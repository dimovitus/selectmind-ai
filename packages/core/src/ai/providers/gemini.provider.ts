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
import type { AIProviderPort } from '../ai-provider.port';
import { extractGeminiDelta, parseSSEStream, readErrorBody } from '../streaming/sse-parser';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements AIProviderPort {
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
    const response = await fetch(
      `${GEMINI_BASE}/models?key=${encodeURIComponent(this.apiKey)}`,
    );

    if (!response.ok) {
      throw new Error(await readErrorBody(response));
    }

    const data = (await response.json()) as {
      models?: { name: string; displayName?: string }[];
    };

    return (data.models ?? [])
      .filter((m) => m.name.includes('gemini'))
      .map((m) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName ?? m.name.replace('models/', ''),
        providerId: this.config.id,
        supportsVision: m.name.includes('vision') || m.name.includes('pro'),
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

    const { contents, systemInstruction } = this.toGeminiFormat(request);
    const model = request.model.startsWith('models/')
      ? request.model.replace('models/', '')
      : request.model;

    const url = `${GEMINI_BASE}/models/${model}:streamGenerateContent?key=${encodeURIComponent(this.apiKey)}&alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
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

    for await (const { data } of parseSSEStream(response.body)) {
      const delta = extractGeminiDelta(data);
      if (delta) {
        yield { type: 'text', content: delta };
      }
    }

    yield { type: 'done' };
  }

  private toGeminiFormat(request: CompletionRequest): {
    contents: { role: string; parts: { text: string }[] }[];
    systemInstruction?: { parts: { text: string }[] };
  } {
    const systemPrompt =
      request.systemPrompt ?? request.messages.find((m) => m.role === 'system')?.content;

    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toGeminiMessage(m));

    return {
      contents,
      systemInstruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
    };
  }

  private toGeminiMessage(message: ChatMessage): {
    role: string;
    parts: { text: string }[];
  } {
    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    };
  }
}
