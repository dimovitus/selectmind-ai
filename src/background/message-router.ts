import { getContainer } from '@/di/container';
import { ensureDatabaseSeeded, reloadProviderRegistry } from './seed';
import { pageContextToBundle } from '@/shared/types/page-context';
import {
  createConversationId,
  createMessageId,
  now,
  type ActionId,
} from '@/domain/shared/ids';
import { buildActionPrompt } from '@/application/stream-conversation.use-case';
import type { ConversationMode } from '@/domain/conversation/conversation.schema';
import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import { ActionSchema, CategorySchema } from '@/domain/action/action.schema';
import { buildExportBundle, parseExportBundle } from '@/application/import-export.use-case';
import { PipelineSchema } from '@/domain/provider/provider.schema';
import { PushEmitter } from '@/infrastructure/messaging/rpc-client';
import { refreshContextMenus } from './context-menus';
import { localizeAction, localizeActions } from '@/shared/utils/localize-action';

const pushEmitter = new PushEmitter();

export function setupMessageRouter(): void {
  const {
    rpcServer,
    actionRepo,
    categoryRepo,
    conversationRepo,
    messageRepo,
    settingsRepo,
    providerRepo,
    pipelineRepo,
    streamConversation,
    runPipeline,
    aiRouter,
    platform,
  } = getContainer();

  rpcServer.register('ping', async () => ({
    pong: true as const,
    timestamp: Date.now(),
  }));

  rpcServer.register('action:list', async () => {
    await ensureDatabaseSeeded();
    const settings = await settingsRepo.get();
    const actions = await actionRepo.getAll();
    return localizeActions(actions, settings.responseLanguage);
  });

  rpcServer.register('action:toolbar', async () => {
    await ensureDatabaseSeeded();
    const settings = await settingsRepo.get();
    const allActions = await actionRepo.getAll();
    const actionMap = new Map(allActions.map((a) => [a.id, a]));

    const toolbar =
      settings.toolbarActionIds.length > 0
        ? settings.toolbarActionIds
            .map((id) => actionMap.get(id))
            .filter((a): a is Action => !!a && a.isEnabled)
        : allActions.filter((a) => a.isEnabled).sort((a, b) => a.order - b.order);

    return localizeActions(toolbar, settings.responseLanguage);
  });

  rpcServer.register('action:get', async ({ actionId }) => {
    const action = await actionRepo.getById(actionId);
    if (!action) return null;
    const settings = await settingsRepo.get();
    return localizeAction(action, settings.responseLanguage);
  });

  rpcServer.register('action:save', async ({ action }) => {
    const parsed = ActionSchema.parse(action);
    const existing = await actionRepo.getById(parsed.id);
    const timestamp = now();

    const toSave: Action = {
      ...parsed,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      isBuiltIn: existing?.isBuiltIn ?? false,
    };

    await actionRepo.save(toSave);
    void refreshContextMenus();
    return toSave;
  });

  rpcServer.register('action:delete', async ({ actionId }) => {
    const existing = await actionRepo.getById(actionId);
    if (!existing) throw new Error(`Action not found: ${actionId}`);
    if (existing.isBuiltIn) throw new Error('Cannot delete built-in actions');

    await actionRepo.delete(actionId);

    const settings = await settingsRepo.get();
    if (settings.toolbarActionIds.includes(actionId)) {
      await settingsRepo.update({
        toolbarActionIds: settings.toolbarActionIds.filter((id) => id !== actionId),
      });
    }
  });

  rpcServer.register('category:list', async () => categoryRepo.getAll());

  rpcServer.register('category:save', async ({ category }) => {
    const parsed = CategorySchema.parse(category);
    const existing = await categoryRepo.getById(parsed.id);
    const timestamp = now();

    const toSave: Category = {
      ...parsed,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      isBuiltIn: existing?.isBuiltIn ?? false,
    };

    await categoryRepo.save(toSave);
    return toSave;
  });

  rpcServer.register('category:delete', async ({ categoryId }) => {
    const existing = await categoryRepo.getById(categoryId);
    if (!existing) throw new Error(`Category not found: ${categoryId}`);
    if (existing.isBuiltIn) throw new Error('Cannot delete built-in categories');

    const actionsInCategory = await actionRepo.getByCategory(categoryId);
    if (actionsInCategory.length > 0) {
      throw new Error(`Category has ${actionsInCategory.length} action(s). Move or delete them first.`);
    }

    await categoryRepo.delete(categoryId);
  });

  rpcServer.register('settings:get', async () => settingsRepo.get());

  rpcServer.register('settings:update', async (partial) => {
    const result = await settingsRepo.update(partial);
    if (partial.toolbarActionIds !== undefined || partial.responseLanguage !== undefined) {
      void refreshContextMenus();
    }
    return result;
  });

  rpcServer.register('provider:list', async () => {
    const providers = await providerRepo.getAll();
    return providers.map(stripApiKey);
  });

  rpcServer.register('provider:save', async ({ config, apiKey }) => {
    const trimmedKey = apiKey?.trim();

    if (trimmedKey) {
      await platform.secrets.storeApiKey(config.id, trimmedKey);
    }

    if (config.enabled && config.type === 'cloud') {
      const hasKey = Boolean(trimmedKey) || (await platform.secrets.hasApiKey(config.id));
      if (!hasKey) {
        throw new Error('API key is required for cloud providers');
      }
    }

    await providerRepo.save(config);
    await reloadProviderRegistry();
    return stripApiKey(config);
  });

  rpcServer.register('provider:delete', async ({ providerId }) => {
    await providerRepo.delete(providerId);
    await platform.secrets.deleteApiKey(providerId);
    await reloadProviderRegistry();
  });

  rpcServer.register('provider:models', async ({ providerId }) => {
    return aiRouter.listModels(providerId);
  });

  rpcServer.register('conversation:get', async ({ conversationId }) =>
    conversationRepo.getById(conversationId),
  );

  rpcServer.register('conversation:messages', async ({ conversationId, limit, before }) => {
    if (limit || before) {
      return messageRepo.getByConversationPaginated(conversationId, { limit, before });
    }
    const messages = await messageRepo.getByConversation(conversationId);
    return { messages, hasMore: false };
  });

  rpcServer.register('conversation:list', async (payload) => {
    return conversationRepo.getRecent(payload?.limit ?? 20);
  });

  rpcServer.register('conversation:clear-all', async () => {
    const deleted = await conversationRepo.deleteAll();
    return { deleted };
  });

  rpcServer.register('conversation:delete', async ({ conversationId }) => {
    await conversationRepo.delete(conversationId);
  });

  rpcServer.register('conversation:promote', async ({ conversationId, mode }) => {
    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const updated = { ...conversation, mode, ephemeral: false, updatedAt: now() };
    await conversationRepo.save(updated);
    return updated;
  });

  rpcServer.register('conversation:create', async ({ mode, contextBundle, sourceActionId }) => {
    const conversationId = createConversationId();
    const timestamp = now();
    const ephemeral = await shouldMarkConversationEphemeral(settingsRepo);

    await conversationRepo.save({
      id: conversationId,
      mode,
      contextBundle,
      sourceActionId,
      ephemeral,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { conversationId };
  });

  rpcServer.register('action:execute', async ({ actionId, context }) => {
    const action = await actionRepo.getById(actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    const settings = await settingsRepo.get();
    const localizedAction = localizeAction(action, settings.responseLanguage, context.language);
    const contextBundle = pageContextToBundle(context);

    if (localizedAction.pipelineId) {
      return runPipeline.execute({
        pipelineId: localizedAction.pipelineId,
        contextBundle,
        sourceAction: localizedAction,
      });
    }

    const conversationId = createConversationId();
    const timestamp = now();
    const resolvedPrompt = buildActionPrompt(localizedAction, contextBundle);
    const ephemeral = await shouldMarkConversationEphemeral(settingsRepo);

    await conversationRepo.save({
      id: conversationId,
      mode: outputModeToConversationMode(localizedAction.outputMode),
      contextBundle,
      sourceActionId: actionId,
      ephemeral,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await messageRepo.save({
      id: createMessageId(),
      conversationId,
      role: 'user',
      content: resolvedPrompt,
      createdAt: timestamp,
    });

    void streamConversation
      .execute({ conversationId, contextBundle, action: localizedAction })
      .catch(console.error);

    return { conversationId };
  });

  rpcServer.register('pipeline:list', async () => pipelineRepo.getAll());

  rpcServer.register('pipeline:run', async ({ pipelineId, context }) => {
    const contextBundle = pageContextToBundle(context);
    const result = await runPipeline.execute({ pipelineId, contextBundle });
    return result;
  });

  rpcServer.register('export:bundle', async () => {
    const [actions, categories, pipelines, providers, settings] = await Promise.all([
      actionRepo.getAll(),
      categoryRepo.getAll(),
      pipelineRepo.getAll(),
      providerRepo.getAll(),
      settingsRepo.get(),
    ]);
    return buildExportBundle({
      actions,
      categories,
      pipelines,
      providers: providers.map(stripApiKey),
      settings,
    });
  });

  rpcServer.register('import:bundle', async ({ bundle: raw }) => {
    const bundle = typeof raw === 'string' ? parseExportBundle(raw) : raw;
    let imported = 0;

    for (const category of bundle.categories) {
      await categoryRepo.save({ ...CategorySchema.parse(category), updatedAt: now() });
      imported++;
    }
    for (const action of bundle.actions) {
      await actionRepo.save({ ...ActionSchema.parse(action), updatedAt: now() });
      imported++;
    }
    for (const pipeline of bundle.pipelines) {
      await pipelineRepo.save({ ...PipelineSchema.parse(pipeline), updatedAt: now() });
      imported++;
    }
    for (const provider of bundle.providers) {
      await providerRepo.save({ ...stripApiKey(provider), updatedAt: now() });
      imported++;
    }
    if (bundle.settings) {
      await settingsRepo.update(bundle.settings);
    }

    await reloadProviderRegistry();
    return { imported };
  });

  rpcServer.register('conversation:continue', async ({ conversationId, message }) => {
    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const messageId = createMessageId();
    const timestamp = now();

    await messageRepo.save({
      id: messageId,
      conversationId,
      role: 'user',
      content: message,
      createdAt: timestamp,
    });

    await conversationRepo.save({ ...conversation, updatedAt: timestamp });

    const settings = await settingsRepo.get();
    const sourceAction = conversation.sourceActionId
      ? await actionRepo.getById(conversation.sourceActionId as ActionId)
      : null;
    const localizedAction = sourceAction
      ? localizeAction(
          sourceAction,
          settings.responseLanguage,
          conversation.contextBundle.language,
        )
      : undefined;

    void streamConversation
      .execute({
        conversationId,
        contextBundle: conversation.contextBundle,
        action: localizedAction,
      })
      .catch(console.error);

    return { messageId };
  });

  rpcServer.register('conversation:add-context', async ({ conversationId, fragment }) => {
    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    await conversationRepo.save({
      ...conversation,
      contextBundle: {
        ...conversation.contextBundle,
        customFragments: [...conversation.contextBundle.customFragments, fragment],
      },
      updatedAt: now(),
    });

    pushEmitter.emit('context:updated', { conversationId });
  });

  rpcServer.register('context:get', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    return new Promise<import('@/shared/types/page-context').PageContext>((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id!, { type: 'saywa:extract-context' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response as import('@/shared/types/page-context').PageContext);
      });
    });
  });

  rpcServer.listen();
}

function outputModeToConversationMode(
  outputMode: 'popup' | 'chat' | 'workspace' | 'replace' | 'clipboard',
): ConversationMode {
  switch (outputMode) {
    case 'workspace':
      return 'workspace';
    case 'chat':
      return 'chat';
    default:
      return 'quick';
  }
}

function stripApiKey(config: ProviderConfig): ProviderConfig {
  return { ...config, apiKey: undefined };
}

async function shouldMarkConversationEphemeral(
  settingsRepo: { get(): Promise<import('@/shared/types/settings').Settings> },
): Promise<boolean> {
  const settings = await settingsRepo.get();
  return !settings.saveConversationHistory;
}
