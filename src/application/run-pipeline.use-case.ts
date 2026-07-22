import type { ContextBundle } from '@/domain/conversation/conversation.schema';
import type { Pipeline, PipelineStep } from '@/domain/provider/provider.schema';
import type { Action } from '@/domain/action/action.schema';
import {
  createConversationId,
  createMessageId,
  now,
  type ConversationId,
} from '@/domain/shared/ids';
import { resolveTemplate, buildContextSystemMessage } from '@/domain/template/template-engine';
import { aiRouter } from '@/infrastructure/ai/ai-router';
import { PushEmitter } from '@/infrastructure/messaging/rpc-client';
import type { ActionRepositoryPort } from '@/infrastructure/storage/repositories/action.repository';
import type { ConversationRepositoryPort } from '@/infrastructure/storage/repositories/conversation.repository';
import type { MessageRepositoryPort } from '@/infrastructure/storage/repositories/conversation.repository';
import type { PipelineRepositoryPort } from '@/infrastructure/storage/repositories/pipeline.repository';
import type { ProviderRepositoryPort } from '@/infrastructure/storage/repositories/settings.repository';
import type { SettingsRepository } from '@/infrastructure/storage/repositories/settings.repository';

export interface RunPipelineParams {
  pipelineId: Pipeline['id'];
  contextBundle: ContextBundle;
  sourceAction?: Action;
}

export class RunPipelineUseCase {
  private pushEmitter = new PushEmitter();

  constructor(
    private pipelineRepo: PipelineRepositoryPort,
    private actionRepo: ActionRepositoryPort,
    private conversationRepo: ConversationRepositoryPort,
    private messageRepo: MessageRepositoryPort,
    private providerRepo: ProviderRepositoryPort,
    private settingsRepo: SettingsRepository,
  ) {}

  async execute(params: RunPipelineParams): Promise<{ conversationId: ConversationId }> {
    const pipeline = await this.pipelineRepo.getById(params.pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${params.pipelineId}`);

    const conversationId = createConversationId();
    const timestamp = now();
    const mode =
      pipeline.finalOutputMode === 'workspace'
        ? 'workspace'
        : pipeline.finalOutputMode === 'chat'
          ? 'chat'
          : 'quick';

    await this.conversationRepo.save({
      id: conversationId,
      mode,
      contextBundle: params.contextBundle,
      sourceActionId: params.sourceAction?.id,
      pipelineRunId: pipeline.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.messageRepo.save({
      id: createMessageId(),
      conversationId,
      role: 'user',
      content: `[Pipeline: ${pipeline.name}]\nInput: ${params.contextBundle.selection ?? ''}`,
      createdAt: timestamp,
    });

    void this.runSteps(conversationId, pipeline, params).catch(console.error);

    return { conversationId };
  }

  private async runSteps(
    conversationId: ConversationId,
    pipeline: Pipeline,
    params: RunPipelineParams,
  ): Promise<void> {
    const settings = await this.settingsRepo.get();
    const providerId = params.sourceAction?.providerId ?? settings.defaultProviderId;

    if (!providerId) {
      this.pushEmitter.emit('stream:error', {
        conversationId,
        error: 'No AI provider configured.',
      });
      return;
    }

    const provider = await this.providerRepo.getById(providerId);
    if (!provider?.enabled) {
      this.pushEmitter.emit('stream:error', {
        conversationId,
        error: 'Provider not enabled.',
      });
      return;
    }

    const model =
      params.sourceAction?.model ?? settings.defaultModel ?? provider.defaultModel;
    const steps = [...pipeline.steps].sort((a, b) => a.order - b.order);
    let prevOutput = params.contextBundle.selection ?? '';
    const extraVars: Record<string, string> = {};

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const isLast = i === steps.length - 1;
        const prompt = await this.resolveStepPrompt(step, params.contextBundle, extraVars);
        extraVars.prev_output = prevOutput;

        const resolved = resolveTemplate(prompt, params.contextBundle, {
          ...extraVars,
          prev_output: prevOutput,
        });

        if (isLast) {
          const systemPrompt = buildContextSystemMessage(
            params.contextBundle,
            settings.responseLanguage,
          );
          let fullContent = '';

          for await (const chunk of aiRouter.stream(providerId, model, {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: resolved },
            ],
            temperature: params.sourceAction?.temperature ?? 0.7,
          })) {
            if (chunk.type === 'text') {
              fullContent += chunk.content;
              this.pushEmitter.emit('stream:chunk', { conversationId, chunk });
            } else if (chunk.type === 'error') {
              this.pushEmitter.emit('stream:error', { conversationId, error: chunk.error });
              return;
            }
          }

          const assistantId = createMessageId();
          await this.messageRepo.save({
            id: assistantId,
            conversationId,
            role: 'assistant',
            content: fullContent,
            providerId,
            model: model ?? undefined,
            createdAt: now(),
          });

          this.pushEmitter.emit('stream:done', { conversationId, messageId: assistantId });
        } else {
          const { provider: aiProvider, model: resolvedModel } = aiRouter.resolve(providerId, model);
          prevOutput = await aiProvider.complete({
            model: resolvedModel,
            messages: [{ role: 'user', content: resolved }],
            temperature: params.sourceAction?.temperature ?? 0.7,
          });
          extraVars[step.passOutputAs] = prevOutput;
        }
      }

      const conv = await this.conversationRepo.getById(conversationId);
      if (conv) {
        await this.conversationRepo.save({ ...conv, updatedAt: now() });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pipeline failed';
      this.pushEmitter.emit('stream:error', { conversationId, error: message });
    }
  }

  private async resolveStepPrompt(
    step: PipelineStep,
    contextBundle: ContextBundle,
    extraVars: Record<string, string>,
  ): Promise<string> {
    if (step.actionId) {
      const action = await this.actionRepo.getById(step.actionId);
      if (action) {
        return resolveTemplate(action.prompt, contextBundle, extraVars);
      }
    }
    return step.prompt ?? '';
  }
}
