import type {
  CompletionRequest,
  ModelInfo,
  ProviderConfig,
  StreamChunk,
} from '../domain/provider/provider.schema';
import type { ProviderId } from '../domain/shared/ids';
import type { Result } from '../domain/shared/result';

export interface AIProviderPort {
  readonly id: ProviderId;
  readonly config: ProviderConfig;

  listModels(): Promise<ModelInfo[]>;
  complete(request: CompletionRequest): Promise<string>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  validateConfig(): Promise<Result<void>>;
}

export interface ResolvedProvider {
  provider: AIProviderPort;
  model: string;
}
