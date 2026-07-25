import type { ContextBundle } from '../domain/conversation/conversation.schema';
import type { Pipeline, PipelineStep } from '../domain/provider/provider.schema';
import type { Action } from '../domain/action/action.schema';
import {
  createConversationId,
  createMessageId,
  now,
  type ConversationId,
} from '../domain/shared/ids';
import { resolveTemplate, buildContextSystemMessage } from '../domain/template/template-engine';
import type { AIRouter } from '../ai/ai-router';
import type {
  ActionRepositoryPort,
  ConversationRepositoryPort,
  MessageRepositoryPort,
  PipelineRepositoryPort,
  ProviderRepositoryPort,
} from '../ports/repositories.port';
import type { SettingsPort } from '../ports/settings.port';
import type { StreamEventsPort } from '../ports/stream-events.port';

export interface RunPipelineParams {
  pipelineId: Pipeline['id'];
  contextBundle: ContextBundle;
  sourceAction?: Action;
}

export class RunPipelineUseCase {
  constructor(
    private pipelineRepo: PipelineRepositoryPort,
    private actionRepo: ActionRepositoryPort,
    private conversationRepo: ConversationRepositoryPort,
    private messageRepo: MessageRepositoryPort,
    private providerRepo: ProviderRepositoryPort,
    private settings: SettingsPort,
    private streamEvents: StreamEventsPort,
    private aiRouter: AIRouter,
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
    const settings = await this.settings.get();

    await this.conversationRepo.save({
      id: conversationId,
      mode,
      contextBundle: params.contextBundle,
      sourceActionId: params.sourceAction?.id,
      pipelineRunId: pipeline.id,
      ephemeral: !settings.saveConversationHistory,
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
    const settings = await this.settings.get();
    const providerId = params.sourceAction?.providerId ?? settings.defaultProviderId;

    if (!providerId) {
      this.streamEvents.emitStreamError(conversationId, 'No AI provider configured.');
      return;
    }

    const provider = await this.providerRepo.getById(providerId);
    if (!provider?.enabled) {
      this.streamEvents.emitStreamError(conversationId, 'Provider not enabled.');
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

          for await (const chunk of this.aiRouter.stream(providerId, model, {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: resolved },
            ],
            temperature: params.sourceAction?.temperature ?? 0.7,
          })) {
            if (chunk.type === 'text') {
              fullContent += chunk.content;
              this.streamEvents.emitStreamChunk(conversationId, chunk);
            } else if (chunk.type === 'error') {
              this.streamEvents.emitStreamError(conversationId, chunk.error);
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

          this.streamEvents.emitStreamDone(conversationId, assistantId);
        } else {
          const { provider: aiProvider, model: resolvedModel } = this.aiRouter.resolve(providerId, model);
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
      this.streamEvents.emitStreamError(conversationId, message);
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
