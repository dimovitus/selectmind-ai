import type { Action, Category } from '../domain/action/action.schema';
import type { Pipeline, ProviderConfig } from '../domain/provider/provider.schema';
import type { AppSettings } from '../types/settings';

export const EXPORT_VERSION = '1.0';

export interface ExportBundle {
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  actions: Action[];
  categories: Category[];
  pipelines: Pipeline[];
  providers: ProviderConfig[];
  settings: Pick<
    AppSettings,
    | 'theme'
    | 'responseLanguage'
    | 'toolbarActionIds'
    | 'showFloatingToolbar'
    | 'enableStreaming'
    | 'defaultProviderId'
    | 'defaultModel'
  >;
}

export function buildExportBundle(data: {
  actions: Action[];
  categories: Category[];
  pipelines: Pipeline[];
  providers: ProviderConfig[];
  settings: AppSettings;
}): ExportBundle {
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    actions: data.actions.filter((a) => !a.isBuiltIn),
    categories: data.categories.filter((c) => !c.isBuiltIn),
    pipelines: data.pipelines.filter((p) => !p.isBuiltIn),
    providers: data.providers.map((p) => ({ ...p, apiKey: undefined })),
    settings: {
      theme: data.settings.theme,
      responseLanguage: data.settings.responseLanguage,
      toolbarActionIds: data.settings.toolbarActionIds,
      showFloatingToolbar: data.settings.showFloatingToolbar,
      enableStreaming: data.settings.enableStreaming,
      defaultProviderId: data.settings.defaultProviderId,
      defaultModel: data.settings.defaultModel,
    },
  };
}

export function parseExportBundle(json: string): ExportBundle {
  const parsed = JSON.parse(json) as ExportBundle;
  if (parsed.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${parsed.version}`);
  }
  return parsed;
}
