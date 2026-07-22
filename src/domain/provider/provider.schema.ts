import { z } from 'zod';
import type { ActionId, PipelineId, PipelineStepId, ProviderId } from '../shared/ids';
import { OutputModeSchema } from '../action/action.schema';

export const ProviderTypeSchema = z.enum(['cloud', 'local']);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const AdapterTypeSchema = z.enum([
  'openai-compatible',
  'anthropic',
  'gemini',
  'custom',
]);

export type AdapterType = z.infer<typeof AdapterTypeSchema>;

export const ProviderConfigSchema = z.object({
  id: z.string().transform((v) => v as ProviderId),
  name: z.string().min(1).max(100),
  type: ProviderTypeSchema,
  adapterType: AdapterTypeSchema,
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  enabled: z.boolean().default(true),
  capabilities: z
    .object({
      streaming: z.boolean().default(true),
      vision: z.boolean().default(false),
      functionCalling: z.boolean().default(false),
    })
    .default({ streaming: true, vision: false, functionCalling: false }),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerId: z.string().transform((v) => v as ProviderId),
  contextWindow: z.number().int().optional(),
  supportsVision: z.boolean().default(false),
});

export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(ChatMessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
});

export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;

export const StreamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({
    type: z.literal('done'),
    usage: z
      .object({
        prompt: z.number().int(),
        completion: z.number().int(),
        total: z.number().int(),
      })
      .optional(),
  }),
  z.object({ type: z.literal('error'), error: z.string() }),
]);

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

export const PipelineStepSchema = z.object({
  id: z.string().transform((v) => v as PipelineStepId),
  actionId: z
    .string()
    .transform((v) => v as ActionId)
    .optional(),
  prompt: z.string().optional(),
  providerId: z
    .string()
    .transform((v) => v as ProviderId)
    .optional(),
  model: z.string().optional(),
  passOutputAs: z.string().default('prev_output'),
  order: z.number().int().min(0),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

export const PipelineSchema = z.object({
  id: z.string().transform((v) => v as PipelineId),
  name: z.string().min(1).max(100),
  steps: z.array(PipelineStepSchema),
  finalOutputMode: OutputModeSchema.default('popup'),
  isBuiltIn: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Pipeline = z.infer<typeof PipelineSchema>;
