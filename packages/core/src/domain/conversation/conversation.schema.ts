import { z } from 'zod';
import type { ConversationId, ContextFragmentId, MessageId, ProviderId } from '../shared/ids';
import { OutputModeSchema } from '../action/action.schema';

export const ConversationModeSchema = z.enum(['quick', 'chat', 'workspace']);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const ContextFragmentSchema = z.object({
  id: z.string().transform((v) => v as ContextFragmentId),
  label: z.string().min(1).max(100),
  content: z.string().min(1).max(32000),
  addedAt: z.number(),
});

export type ContextFragment = z.infer<typeof ContextFragmentSchema>;

export const ScreenshotContextSchema = z.object({
  dataUrl: z.string(),
  ocrText: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type ScreenshotContext = z.infer<typeof ScreenshotContextSchema>;

export const ContextBundleSchema = z.object({
  selection: z.string().optional(),
  pageTitle: z.string().optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  pageText: z.string().optional(),
  clipboard: z.string().optional(),
  language: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  screenshot: ScreenshotContextSchema.optional(),
  customFragments: z.array(ContextFragmentSchema).default([]),
});

export type ContextBundle = z.infer<typeof ContextBundleSchema>;

export const MessageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string().transform((v) => v as MessageId),
  conversationId: z.string().transform((v) => v as ConversationId),
  role: MessageRoleSchema,
  content: z.string(),
  providerId: z
    .string()
    .transform((v) => v as ProviderId)
    .optional(),
  model: z.string().optional(),
  tokenUsage: z
    .object({
      prompt: z.number().int(),
      completion: z.number().int(),
      total: z.number().int(),
    })
    .optional(),
  createdAt: z.number(),
});

export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.string().transform((v) => v as ConversationId),
  mode: ConversationModeSchema,
  contextBundle: ContextBundleSchema,
  sourceActionId: z.string().optional(),
  pipelineRunId: z.string().optional(),
  ephemeral: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

export const CreateConversationSchema = z.object({
  mode: ConversationModeSchema,
  contextBundle: ContextBundleSchema,
  sourceActionId: z.string().optional(),
  outputMode: OutputModeSchema.optional(),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
