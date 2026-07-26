import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ModelListItem {
  id: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  packageVersion: string;
  downloadUrl: string;
  sizeBytes: number;
  installed: boolean;
  installedSizeBytes: number | null;
}

export interface ModelsListResult {
  modelsDir: string;
  totalInstalledBytes: number;
  items: ModelListItem[];
}

export interface ModelStatus {
  id: string;
  installed: boolean;
  path: string | null;
  sizeBytes: number | null;
}

export interface ModelDownloadProgress {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number | null;
  phase: 'downloading' | 'complete' | 'error' | string;
  message: string | null;
}

export function formatModelBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${Math.round(bytes / 1_048_576)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function formatModelPairLabel(item: Pick<ModelListItem, 'fromName' | 'toName'>): string {
  return `${item.fromName} → ${item.toName}`;
}

export async function listOfflineModels(): Promise<ModelsListResult> {
  return invoke<ModelsListResult>('models_list');
}

export async function getOfflineModelStatus(modelId: string): Promise<ModelStatus> {
  return invoke<ModelStatus>('models_status', { modelId });
}

export async function downloadOfflineModel(modelId: string): Promise<ModelStatus> {
  return invoke<ModelStatus>('models_download', { modelId });
}

export async function deleteOfflineModel(modelId: string): Promise<void> {
  return invoke<void>('models_delete', { modelId });
}

export async function pingArgosSidecar(): Promise<string> {
  return invoke<string>('argos_sidecar_ping');
}

export function listenOfflineModelDownloadProgress(
  handler: (progress: ModelDownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<ModelDownloadProgress>('model-download-progress', (event) => {
    handler(event.payload);
  });
}

export function isOfflinePairInstalled(
  items: ModelListItem[],
  fromCode: string,
  toCode: string,
): boolean {
  const from = fromCode.trim().toLowerCase();
  const to = toCode.trim().toLowerCase();
  return items.some(
    (item) => item.installed && item.fromCode.toLowerCase() === from && item.toCode.toLowerCase() === to,
  );
}
