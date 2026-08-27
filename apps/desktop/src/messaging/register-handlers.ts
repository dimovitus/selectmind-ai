import {
  ActionSchema,
  CategorySchema,
  PipelineSchema,
  buildActionPrompt,
  buildExportBundle,
  createConversationId,
  createMessageId,
  createProviderAdapter,
  now,
  parseExportBundle,
  type ActionId,
  type ProviderConfig,
} from '@selectmind/core';
import { localizeAction, localizeActions, pageContextToBundle } from '@selectmind/shared';
import type { ConversationMode } from '@selectmind/core';
import type { DesktopContainer } from '../di/container';
import { reloadProviderRegistry } from '../storage/seed';
import { pushListener, rpcClient } from './desktop-rpc-client';

let registered = false;

async function syncProviderRegistry(container: DesktopContainer): Promise<void> {
  await reloadProviderRegistry(container);
}

function stripApiKey(config: ProviderConfig): ProviderConfig {
  return { ...config, apiKey: undefined };
}

async function shouldMarkConversationEphemeral(
  settings: Awaited<ReturnType<DesktopContainer['platform']['settings']['get']>>,
): Promise<boolean> {
  return !settings.saveConversationHistory;
}

function outputModeToConversationMode(outputMode: string): ConversationMode {
  switch (outputMode) {
    case 'workspace':
      return 'workspace';
    case 'chat':
      return 'chat';
    default:
      return 'quick';
  }
}

export function registerDesktopRpcHandlers(container: DesktopContainer): void {
  if (registered) return;
  registered = true;

  const {
    actionRepo,
    categoryRepo,
    conversationRepo,
    messageRepo,
    pipelineRepo,
    providerRepo,
    platform,
    runPipeline,
    streamConversation,
  } = container;

  rpcClient.register('ping', async () => ({
    pong: true as const,
    timestamp: Date.now(),
  }));

  rpcClient.register('settings:get', async () => platform.settings.get());

  rpcClient.register('settings:update', async (partial) => platform.settings.update(partial));

  rpcClient.register('provider:list', async () => {
    const providers = await providerRepo.getAll();
    return providers.map(stripApiKey);
  });

  rpcClient.register('provider:save', async ({ config, apiKey }) => {
    const trimmedKey = apiKey?.trim();

    if (trimmedKey) {
      await platform.secrets.storeApiKey(config.id, trimmedKey);
      const stored = await platform.secrets.getApiKey(config.id);
      if (!stored) {
        throw new Error(
          'Could not store the API key in Windows Credential Manager. Try again or restart the app.',
        );
      }
    }

    if (config.enabled && config.type === 'cloud') {
      const hasKey = Boolean(trimmedKey) || (await platform.secrets.hasApiKey(config.id));
      if (!hasKey) {
        throw new Error('API key is required for cloud providers');
      }
    }

    await providerRepo.save(config);
    await reloadProviderRegistry(container);
    return stripApiKey(config);
  });

  rpcClient.register('provider:delete', async ({ providerId }) => {
    await providerRepo.delete(providerId);
    await platform.secrets.deleteApiKey(providerId);
    await reloadProviderRegistry(container);
  });

  rpcClient.register('provider:models', async ({ providerId, apiKey }) => {
    const config = await providerRepo.getById(providerId);
    if (!config) throw new Error(`Provider not found: ${providerId}`);

    const trimmedKey = apiKey?.trim();
    const resolvedKey =
      trimmedKey || (await platform.secrets.getApiKey(providerId)) || '';

    if (config.type === 'cloud' && !resolvedKey) {
      throw new Error('API key is required');
    }

    const adapter = createProviderAdapter(config, resolvedKey);
    if (!adapter) {
      throw new Error(`Unsupported provider adapter: ${config.adapterType}`);
    }

    return adapter.listModels();
  });

  rpcClient.register('secrets:has-key', async ({ providerId }) => {
    const hasKey = await platform.secrets.hasApiKey(providerId);
    return { hasKey };
  });

  rpcClient.register('action:list', async () => {
    const settings = await platform.settings.get();
    const actions = await actionRepo.getAll();
    return localizeActions(actions, settings.responseLanguage);
  });

  rpcClient.register('action:toolbar', async () => {
    const settings = await platform.settings.get();
    const allActions = await actionRepo.getAll();
    const actionMap = new Map(allActions.map((action) => [action.id, action]));

    const toolbar =
      settings.toolbarActionIds.length > 0
        ? settings.toolbarActionIds
            .map((id) => actionMap.get(id))
            .filter((action): action is NonNullable<typeof action> => !!action && action.isEnabled)
        : allActions.filter((action) => action.isEnabled).sort((a, b) => a.order - b.order);

    return localizeActions(toolbar, settings.responseLanguage);
  });

  rpcClient.register('action:get', async ({ actionId }) => {
    const action = await actionRepo.getById(actionId);
    if (!action) return null;
    const settings = await platform.settings.get();
    return localizeAction(action, settings.responseLanguage);
  });

  rpcClient.register('action:save', async ({ action }) => {
    const parsed = ActionSchema.parse(action);
    const existing = await actionRepo.getById(parsed.id);
    const timestamp = now();

    const toSave = {
      ...parsed,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      isBuiltIn: existing?.isBuiltIn ?? false,
    };

    await actionRepo.save(toSave);
    return toSave;
  });

  rpcClient.register('action:delete', async ({ actionId }) => {
    const existing = await actionRepo.getById(actionId);
    if (!existing) throw new Error(`Action not found: ${actionId}`);
    if (existing.isBuiltIn) throw new Error('Cannot delete built-in actions');
    await actionRepo.delete(actionId);
  });

  rpcClient.register('category:list', async () => categoryRepo.getAll());

  rpcClient.register('action:execute', async ({ actionId, context }) => {
    await syncProviderRegistry(container);

    const action = await actionRepo.getById(actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    const settings = await platform.settings.get();
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
    const ephemeral = await shouldMarkConversationEphemeral(settings);

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

    // Clipboard has no ChatView to kick off the reply — run the stream here and
    // wait so the caller can read the assistant message immediately after.
    // Popup/chat/workspace defer to ChatView (`conversation:start-assistant`) so
    // listeners are subscribed before the first chunk (avoids a silent hang on
    // Linux where the UI mounts only after this RPC returns).
    if (localizedAction.outputMode === 'clipboard') {
      await streamConversation.execute({
        conversationId,
        contextBundle,
        action: localizedAction,
      });
    }

    return { conversationId };
  });

  rpcClient.register('action:execute-in-conversation', async ({ actionId, context, conversationId }) => {
    await syncProviderRegistry(container);

    const action = await actionRepo.getById(actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const settings = await platform.settings.get();
    const localizedAction = localizeAction(action, settings.responseLanguage, context.language);
    const incomingBundle = pageContextToBundle(context);
    const contextBundle = {
      ...conversation.contextBundle,
      ...incomingBundle,
      customFragments: conversation.contextBundle.customFragments,
    };
    const timestamp = now();
    const resolvedPrompt = buildActionPrompt(localizedAction, contextBundle);

    await conversationRepo.save({
      ...conversation,
      contextBundle,
      updatedAt: timestamp,
    });

    await messageRepo.save({
      id: createMessageId(),
      conversationId,
      role: 'user',
      content: resolvedPrompt,
      createdAt: timestamp,
    });

    // ChatView (already open or about to open) starts the assistant turn so
    // stream listeners are attached before chunks arrive.
    return { conversationId };
  });

  rpcClient.register('conversation:get', async ({ conversationId }) =>
    conversationRepo.getById(conversationId),
  );

  rpcClient.register('conversation:messages', async ({ conversationId, limit, before }) => {
    if (limit || before) {
      return messageRepo.getByConversationPaginated(conversationId, { limit, before });
    }
    const messages = await messageRepo.getByConversation(conversationId);
    return { messages, hasMore: false };
  });

  rpcClient.register('conversation:list', async (payload) =>
    conversationRepo.getRecent(payload?.limit ?? 20),
  );

  rpcClient.register('conversation:clear-all', async () => {
    const deleted = await conversationRepo.deleteAll();
    return { deleted };
  });

  rpcClient.register('conversation:delete', async ({ conversationId }) => {
    await conversationRepo.delete(conversationId);
  });

  rpcClient.register('conversation:promote', async ({ conversationId, mode }) => {
    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const updated = { ...conversation, mode, ephemeral: false, updatedAt: now() };
    await conversationRepo.save(updated);
    return updated;
  });

  rpcClient.register('conversation:create', async ({ mode, contextBundle, sourceActionId }) => {
    const conversationId = createConversationId();
    const timestamp = now();
    const settings = await platform.settings.get();
    const ephemeral = await shouldMarkConversationEphemeral(settings);

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

  rpcClient.register('conversation:continue', async ({ conversationId, message }) => {
    await syncProviderRegistry(container);

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

    const settings = await platform.settings.get();
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

  rpcClient.register('conversation:start-assistant', async ({ conversationId }) => {
    await syncProviderRegistry(container);

    const conversation = await conversationRepo.getById(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const messages = await messageRepo.getByConversation(conversationId);
    const last = messages.at(-1);
    if (!last || last.role !== 'user') {
      return { started: false };
    }

    const settings = await platform.settings.get();
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

    return { started: true };
  });

  rpcClient.register('conversation:add-context', async ({ conversationId, fragment }) => {
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

    pushListener.emit('context:updated', { conversationId });
  });

  rpcClient.register('context:get', async () => {
    const snapshot = await platform.pageContext.extractCurrentContext();
    return snapshot;
  });

  rpcClient.register('pipeline:list', async () => pipelineRepo.getAll());

  rpcClient.register('pipeline:run', async ({ pipelineId, context }) => {
    await syncProviderRegistry(container);

    const contextBundle = pageContextToBundle(context);
    return runPipeline.execute({ pipelineId, contextBundle });
  });

  rpcClient.register('export:bundle', async () => {
    const [actions, categories, pipelines, providers, settings] = await Promise.all([
      actionRepo.getAll(),
      categoryRepo.getAll(),
      pipelineRepo.getAll(),
      providerRepo.getAll(),
      platform.settings.get(),
    ]);
    return buildExportBundle({
      actions,
      categories,
      pipelines,
      providers: providers.map(stripApiKey),
      settings,
    });
  });

  rpcClient.register('import:bundle', async ({ bundle: raw }) => {
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
      await platform.settings.update(bundle.settings);
    }

    await reloadProviderRegistry(container);
    return { imported };
  });
}

export function wireDesktopStreamEvents(container: DesktopContainer): void {
  container.streamEvents.subscribe((event) => {
    if (event.type === 'chunk') {
      pushListener.emit('stream:chunk', {
        conversationId: event.conversationId,
        chunk: event.chunk,
      });
      return;
    }
    if (event.type === 'error') {
      pushListener.emit('stream:error', {
        conversationId: event.conversationId,
        error: event.error,
      });
      return;
    }
    pushListener.emit('stream:done', {
      conversationId: event.conversationId,
      messageId: event.messageId,
    });
  });
}

export function resetDesktopMessaging(): void {
  registered = false;
}
