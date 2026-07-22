import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import type { ExportBundle } from '@/application/import-export.use-case';
import { PRODUCT_SLUG } from '@/shared/constants/brand';

export function ImportExportSection() {
  const [importResult, setImportResult] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: () => rpcClient.call('export:bundle', undefined),
    onSuccess: (bundle) => {
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${PRODUCT_SLUG}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const importMutation = useMutation({
    mutationFn: (bundle: ExportBundle) => rpcClient.call('import:bundle', { bundle }),
    onSuccess: (result) => {
      setImportResult(`Imported ${result.imported} items successfully.`);
    },
    onError: (error: Error) => {
      setImportResult(`Import failed: ${error.message}`);
    },
  });

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result as string) as ExportBundle;
        importMutation.mutate(bundle);
      } catch {
        setImportResult('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import / Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Export custom actions, categories, pipelines, and settings. API keys are never included.
        </p>

        <div className="flex gap-3">
          <Button
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            Export Backup
          </Button>
          <label className="cursor-pointer inline-block">
            <span className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
              {importMutation.isPending ? 'Importing…' : 'Import Backup'}
            </span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>
        </div>

        {importResult && (
          <p className={`text-sm ${importResult.includes('failed') || importResult.includes('Invalid') ? 'text-red-400' : 'text-green-400'}`}>
            {importResult}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
