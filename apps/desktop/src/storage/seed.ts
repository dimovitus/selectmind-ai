import type { ActionId } from '@selectmind/core';
import { providerRegistry } from '@selectmind/core';
import {
  DEFAULT_ACTIONS,
  DEFAULT_CATEGORIES,
  DEFAULT_PIPELINES,
  DEFAULT_PROVIDERS,
  DEFAULT_TOOLBAR_ACTION_IDS,
  TOOLBAR_ACTIONS_MERGE_ON_UPDATE,
} from '@selectmind/shared';
import type { DesktopContainer } from '../di/container';
import { loadAllApiKeys } from '../platform/tauri-secrets.adapter';

let seedPromise: Promise<void> | null = null;

export function ensureDatabaseSeeded(container: DesktopContainer): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedDatabase(container).catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function seedDatabase(container: DesktopContainer): Promise<void> {
  const { actionRepo, categoryRepo, providerRepo, pipelineRepo, platform } = container;

  const existingCategories = await categoryRepo.getAll();
  if (existingCategories.length === 0) {
    await categoryRepo.saveMany(DEFAULT_CATEGORIES);
    await actionRepo.saveMany(DEFAULT_ACTIONS);

    const settings = await platform.settings.get();
    if (settings.toolbarActionIds.length === 0) {
      await platform.settings.update({ toolbarActionIds: DEFAULT_TOOLBAR_ACTION_IDS });
    }
  } else {
    const existingActions = await actionRepo.getAll();
    const existingIds = new Set(existingActions.map((a) => a.id));
    const newActions = DEFAULT_ACTIONS.filter((a) => !existingIds.has(a.id));
    if (newActions.length > 0) {
      await actionRepo.saveMany(newActions);
    }
  }

  const existingProviders = await providerRepo.getAll();
  if (existingProviders.length === 0) {
    await Promise.all(DEFAULT_PROVIDERS.map((p) => providerRepo.save(p)));
  } else {
    const existingIds = new Set(existingProviders.map((p) => p.id));
    const newProviders = DEFAULT_PROVIDERS.filter((p) => !existingIds.has(p.id));
    if (newProviders.length > 0) {
      await Promise.all(newProviders.map((p) => providerRepo.save(p)));
    }
  }

  const existingPipelines = await pipelineRepo.getAll();
  if (existingPipelines.length === 0) {
    await pipelineRepo.saveMany(DEFAULT_PIPELINES);
  } else {
    const existingIds = new Set(existingPipelines.map((p) => p.id));
    const newPipelines = DEFAULT_PIPELINES.filter((p) => !existingIds.has(p.id));
    if (newPipelines.length > 0) {
      await pipelineRepo.saveMany(newPipelines);
    }
  }

  await reloadProviderRegistry(container);
  await mergeToolbarActionIds(container);
}

async function mergeToolbarActionIds(container: DesktopContainer): Promise<void> {
  const settings = await container.platform.settings.get();

  if (settings.toolbarActionIds.length === 0) {
    await container.platform.settings.update({ toolbarActionIds: DEFAULT_TOOLBAR_ACTION_IDS });
    return;
  }

  const missing = TOOLBAR_ACTIONS_MERGE_ON_UPDATE.filter(
    (id) => !settings.toolbarActionIds.includes(id),
  );
  if (missing.length === 0) return;

  const translateIndex = settings.toolbarActionIds.indexOf('act_translate' as ActionId);
  if (translateIndex >= 0) {
    const next = [...settings.toolbarActionIds];
    next.splice(translateIndex + 1, 0, ...missing);
    await container.platform.settings.update({ toolbarActionIds: next });
    return;
  }

  await container.platform.settings.update({
    toolbarActionIds: [...settings.toolbarActionIds, ...missing],
  });
}

export async function reloadProviderRegistry(container: DesktopContainer): Promise<void> {
  const configs = await container.providerRepo.getAll();
  const apiKeys = await loadAllApiKeys(container.platform.secrets, configs.map((c) => c.id));
  providerRegistry.loadFromConfigs(configs, apiKeys);
}
