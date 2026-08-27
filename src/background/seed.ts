import { getContainer } from '@/di/container';
import type { ActionId } from '@/domain/shared/ids';
import { DEFAULT_PROVIDERS } from '@/shared/constants/default-providers';
import { DEFAULT_ACTIONS, DEFAULT_CATEGORIES, DEFAULT_TOOLBAR_ACTION_IDS, TOOLBAR_ACTIONS_MERGE_ON_UPDATE } from '@/shared/constants/default-actions';
import { DEFAULT_PIPELINES } from '@/shared/constants/default-pipelines';
import { providerRegistry } from '@selectmind/core';
import { loadAllApiKeys } from '@/infrastructure/crypto/api-key-store';

let seedPromise: Promise<void> | null = null;

export function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedDatabase().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function seedDatabase(): Promise<void> {
  const { actionRepo, categoryRepo, settingsRepo, providerRepo, pipelineRepo } = getContainer();

  const existingCategories = await categoryRepo.getAll();
  if (existingCategories.length === 0) {
    await categoryRepo.saveMany(DEFAULT_CATEGORIES);
    await actionRepo.saveMany(DEFAULT_ACTIONS);

    const settings = await settingsRepo.get();
    if (settings.toolbarActionIds.length === 0) {
      await settingsRepo.update({ toolbarActionIds: DEFAULT_TOOLBAR_ACTION_IDS });
    }
  } else {
    // Merge new built-in actions added in updates
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

  await reloadProviderRegistry();
  await mergeToolbarActionIds();
}

async function mergeToolbarActionIds(): Promise<void> {
  const { settingsRepo } = getContainer();
  const settings = await settingsRepo.get();

  if (settings.toolbarActionIds.length === 0) {
    await settingsRepo.update({ toolbarActionIds: DEFAULT_TOOLBAR_ACTION_IDS });
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
    await settingsRepo.update({ toolbarActionIds: next });
    return;
  }

  await settingsRepo.update({
    toolbarActionIds: [...settings.toolbarActionIds, ...missing],
  });
}

export async function reloadProviderRegistry(): Promise<void> {
  const { providerRepo } = getContainer();
  const configs = await providerRepo.getAll();
  const apiKeys = await loadAllApiKeys(configs.map((c) => c.id));
  providerRegistry.loadFromConfigs(configs, apiKeys);
}
