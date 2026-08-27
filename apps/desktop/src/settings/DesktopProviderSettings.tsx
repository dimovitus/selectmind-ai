import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProviderConfig, ProviderId } from '@selectmind/core';
import { sortProvidersByBuiltinOrder } from '@selectmind/shared';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

function ProviderEditor({
  provider,
  onClose,
}: {
  provider: ProviderConfig;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(provider.defaultModel ?? '');
  const [testResult, setTestResult] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: keyStatus } = useQuery({
    queryKey: ['secrets', provider.id],
    queryFn: () => rpcClient.call('secrets:has-key', { providerId: provider.id }),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [provider.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updated: ProviderConfig = {
        ...provider,
        defaultModel: model || provider.defaultModel,
        enabled: true,
        updatedAt: Date.now(),
      };
      return rpcClient.call('provider:save', {
        config: updated,
        apiKey: apiKey.trim() || undefined,
      });
    },
    onSuccess: async (saved) => {
      await rpcClient.call('settings:update', {
        defaultProviderId: saved.id,
        defaultModel: model || saved.defaultModel,
      });
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['secrets', provider.id] });
      onClose();
    },
    onError: (error: Error) => {
      setTestResult(`Failed: ${error.message}`);
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const trimmedKey = apiKey.trim();

      if (!trimmedKey && !keyStatus?.hasKey) {
        throw new Error('Enter an API key to test the connection');
      }

      if (trimmedKey) {
        await rpcClient.call('provider:save', {
          config: {
            ...provider,
            defaultModel: model || provider.defaultModel,
            enabled: true,
            updatedAt: Date.now(),
          },
          apiKey: trimmedKey,
        });
        void queryClient.invalidateQueries({ queryKey: ['secrets', provider.id] });
        void queryClient.invalidateQueries({ queryKey: ['providers'] });
      }

      return rpcClient.call('provider:models', {
        providerId: provider.id,
        apiKey: trimmedKey || undefined,
      });
    },
    onSuccess: (models) => {
      setTestResult(`Connected — ${models.length} models available`);
    },
    onError: (error: Error) => {
      setTestResult(`Failed: ${error.message}`);
    },
  });

  const needsKey = provider.type === 'cloud';

  return (
    <div className="mt-3 space-y-3 rounded-md border border-primary/40 bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">
        Configure {provider.name}
      </p>
      {keyStatus?.hasKey ? (
        <p className="text-xs text-green-400">
          A key is stored securely in Windows Credential Manager. Enter a new key only to replace
          it.
        </p>
      ) : null}

      <div>
        <label htmlFor={`api-key-${provider.id}`} className="text-xs text-muted-foreground">
          {needsKey ? 'API Key' : 'API Key (optional for local servers)'}
        </label>
        <input
          ref={inputRef}
          id={`api-key-${provider.id}`}
          type="password"
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={needsKey ? 'sk-... or paste your key' : 'Optional'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={`model-${provider.id}`} className="text-xs text-muted-foreground">
          Default Model
        </label>
        <input
          id={`model-${provider.id}`}
          type="text"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      {testResult ? (
        <p className={`text-xs ${testResult.startsWith('Failed') ? 'text-red-400' : 'text-green-400'}`}>
          {testResult}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || (needsKey && !apiKey.trim() && !keyStatus?.hasKey)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save & Enable'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || (needsKey && !apiKey.trim() && !keyStatus?.hasKey)}
        >
          {testMutation.isPending ? 'Testing…' : 'Test Connection'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  expanded,
  onToggleExpand,
}: {
  provider: ProviderConfig;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const queryClient = useQueryClient();
  const rowRef = useRef<HTMLDivElement>(null);

  const { data: keyStatus } = useQuery({
    queryKey: ['secrets', provider.id],
    queryFn: () => rpcClient.call('secrets:has-key', { providerId: provider.id }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      rpcClient.call('provider:save', {
        config: { ...provider, enabled, updatedAt: Date.now() },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
    onError: (error: Error) => {
      window.alert(error.message);
    },
  });

  const handleToggle = () => {
    if (!provider.enabled && provider.type === 'cloud') {
      onToggleExpand();
      return;
    }
    if (provider.enabled && provider.type === 'cloud' && !keyStatus?.hasKey) {
      onToggleExpand();
      return;
    }
    toggleMutation.mutate(!provider.enabled);
  };

  useEffect(() => {
    if (expanded) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);

  return (
    <div ref={rowRef} className="rounded-md border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{provider.name}</p>
          <p className="text-xs text-muted-foreground">
            {provider.type === 'local' ? '🖥 Local' : '☁️ Cloud'} · {provider.adapterType}
            {provider.defaultModel ? ` · ${provider.defaultModel}` : ''}
          </p>
          {provider.enabled ? (
            provider.type === 'cloud' && !keyStatus?.hasKey ? (
              <p className="mt-1 text-xs text-amber-400">Enabled · API key missing</p>
            ) : (
              <p className="mt-1 text-xs text-green-400">
                Enabled{keyStatus?.hasKey ? ' · key saved' : ''}
              </p>
            )
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={`Toggle ${provider.name}`}
            className={`relative h-5 w-9 rounded-full transition-colors ${provider.enabled ? 'bg-primary' : 'bg-muted'}`}
            onClick={handleToggle}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${provider.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
          <Button
            type="button"
            variant={expanded ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleExpand}
          >
            {expanded ? 'Close' : 'API Key'}
          </Button>
        </div>
      </div>

      {expanded ? (
        <ProviderEditor provider={provider} onClose={onToggleExpand} />
      ) : null}
    </div>
  );
}

export function DesktopProviderSettings() {
  const [expandedId, setExpandedId] = useState<ProviderId | null>(null);
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => rpcClient.call('provider:list', undefined),
  });

  const sorted = sortProvidersByBuiltinOrder(providers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Нажмите <strong className="text-foreground">API Key</strong> у нужного провайдера, вставьте ключ и
          нажмите <strong className="text-foreground">Save & Enable</strong>.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading providers…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers configured.</p>
        ) : (
          sorted.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              expanded={expandedId === provider.id}
              onToggleExpand={() =>
                setExpandedId((current) => (current === provider.id ? null : provider.id))
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
