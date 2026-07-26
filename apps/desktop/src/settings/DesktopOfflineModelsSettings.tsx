import { useEffect, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
  deleteOfflineModel,
  downloadOfflineModel,
  formatModelBytes,
  formatModelPairLabel,
  listenOfflineModelDownloadProgress,
  listOfflineModels,
  pingArgosSidecar,
  type ModelDownloadProgress,
  type ModelListItem,
  type ModelsListResult,
} from '../live/offline-models';

function progressPercent(progress: ModelDownloadProgress | null): number {
  if (!progress?.totalBytes || progress.totalBytes <= 0) return 0;
  return Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
}

export function DesktopOfflineModelsSettings() {
  const [modelsState, setModelsState] = useState<ModelsListResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sidecarStatus, setSidecarStatus] = useState<string | null>(null);
  const [sidecarPending, setSidecarPending] = useState(false);

  async function refreshModels() {
    setLoadError(null);
    try {
      const result = await listOfflineModels();
      setModelsState(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(message);
    }
  }

  useEffect(() => {
    void refreshModels();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenOfflineModelDownloadProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.phase === 'complete') {
        void refreshModels();
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  async function handleDownload(item: ModelListItem) {
    setActionError(null);
    setActiveDownloadId(item.id);
    setDownloadProgress({
      modelId: item.id,
      downloadedBytes: 0,
      totalBytes: item.sizeBytes,
      phase: 'downloading',
      message: `Downloading ${formatModelPairLabel(item)}`,
    });

    try {
      await downloadOfflineModel(item.id);
      await refreshModels();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(message);
    } finally {
      setActiveDownloadId(null);
      setDownloadProgress(null);
    }
  }

  async function handleDelete(item: ModelListItem) {
    setActionError(null);
    try {
      await deleteOfflineModel(item.id);
      await refreshModels();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(message);
    }
  }

  async function testArgosSidecar() {
    setSidecarPending(true);
    setSidecarStatus(null);
    try {
      const message = await pingArgosSidecar();
      setSidecarStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSidecarStatus(message);
    } finally {
      setSidecarPending(false);
    }
  }

  const activeProgress =
    activeDownloadId && downloadProgress?.modelId === activeDownloadId ? downloadProgress : null;

  return (
    <div className="rounded-md border px-3 py-3">
      <p className="text-sm font-medium text-foreground">Offline translation models</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Argos Translate language packs for fully offline live translate. Stored under{' '}
        <code className="text-foreground">{modelsState?.modelsDir ?? '%APPDATA%/SelectMind/models/'}</code>.
      </p>

      {loadError ? <p className="mt-2 text-xs text-red-400">{loadError}</p> : null}
      {actionError ? <p className="mt-2 text-xs text-red-400">{actionError}</p> : null}

      {modelsState ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Disk usage: {formatModelBytes(modelsState.totalInstalledBytes)} installed
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sidecarPending}
          onClick={() => void testArgosSidecar()}
        >
          {sidecarPending ? 'Starting sidecar…' : 'Test offline engine'}
        </Button>
        {sidecarStatus ? (
          <span
            className={`text-xs ${sidecarStatus.includes('reachable') ? 'text-green-400' : 'text-red-400'}`}
          >
            {sidecarStatus}
          </span>
        ) : null}
      </div>

      {activeProgress ? (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{activeProgress.message ?? 'Downloading model…'}</span>
            <span>{progressPercent(activeProgress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPercent(activeProgress)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatModelBytes(activeProgress.downloadedBytes)}
            {activeProgress.totalBytes ? ` / ${formatModelBytes(activeProgress.totalBytes)}` : ''}
          </p>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {(modelsState?.items ?? []).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-foreground">{formatModelPairLabel(item)}</p>
              <p className="text-muted-foreground">
                ~{formatModelBytes(item.sizeBytes)} · v{item.packageVersion}
                {item.installed && item.installedSizeBytes
                  ? ` · installed ${formatModelBytes(item.installedSizeBytes)}`
                  : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {item.installed ? (
                <>
                  <span className="self-center text-green-400">Installed</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeDownloadId !== null}
                    onClick={() => void handleDelete(item)}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeDownloadId !== null}
                  onClick={() => void handleDownload(item)}
                >
                  Download
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Recommended for games: download <strong>English → Russian</strong>, set source language to English, select{' '}
        <strong>Offline NMT (Argos)</strong>, then press <strong>Test offline engine</strong>. Dev setup:{' '}
        <code className="text-foreground">pip install -r apps/desktop/sidecar/requirements.txt</code>
      </p>
    </div>
  );
}
