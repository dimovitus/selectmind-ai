import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type ActionId = Brand<string, 'ActionId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type PipelineId = Brand<string, 'PipelineId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type PipelineStepId = Brand<string, 'PipelineStepId'>;
export type ContextFragmentId = Brand<string, 'ContextFragmentId'>;

export function createActionId(): ActionId {
  return `act_${nanoid()}` as ActionId;
}

export function createCategoryId(): CategoryId {
  return `cat_${nanoid()}` as CategoryId;
}

export function createConversationId(): ConversationId {
  return `conv_${nanoid()}` as ConversationId;
}

export function createMessageId(): MessageId {
  return `msg_${nanoid()}` as MessageId;
}

export function createPipelineId(): PipelineId {
  return `pipe_${nanoid()}` as PipelineId;
}

export function createProviderId(): ProviderId {
  return `prov_${nanoid()}` as ProviderId;
}

export function createPipelineStepId(): PipelineStepId {
  return `step_${nanoid()}` as PipelineStepId;
}

export function createContextFragmentId(): ContextFragmentId {
  return `ctx_${nanoid()}` as ContextFragmentId;
}

export type Timestamp = number;

export function now(): Timestamp {
  return Date.now();
}
