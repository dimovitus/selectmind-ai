import { z } from 'zod';
import type { ActionId, CategoryId, PipelineId, ProviderId } from '../shared/ids';

export const OutputModeSchema = z.enum([
  'popup',
  'chat',
  'workspace',
  'replace',
  'clipboard',
]);

export type OutputMode = z.infer<typeof OutputModeSchema>;

export const ActionSchema = z.object({
  id: z.string().transform((v) => v as ActionId),
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(10),
  categoryId: z.string().transform((v) => v as CategoryId),
  prompt: z.string().min(1).max(32000),
  providerId: z
    .string()
    .transform((v) => v as ProviderId)
    .optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  streaming: z.boolean().default(true),
  outputMode: OutputModeSchema.default('popup'),
  hotkey: z.string().optional(),
  pipelineId: z
    .string()
    .transform((v) => v as PipelineId)
    .optional(),
  isBuiltIn: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Action = z.infer<typeof ActionSchema>;

export const CategorySchema = z.object({
  id: z.string().transform((v) => v as CategoryId),
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
  order: z.number().int().min(0).default(0),
  isBuiltIn: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Category = z.infer<typeof CategorySchema>;

export const CreateActionSchema = ActionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateActionInput = z.infer<typeof CreateActionSchema>;
