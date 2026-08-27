import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { sortProvidersByBuiltinOrder } from '@/shared/constants/default-providers';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

interface ProviderCardProps {
  provider: ProviderConfig;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(provider.defaultModel ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
        apiKey: apiKey || undefined,
      });
    },
    onSuccess: async (saved) => {
      await rpcClient.call('settings:update', {
        defaultProviderId: saved.id,
        defaultModel: model || saved.defaultModel,
      });
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setIsEditing(false);
      setApiKey('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return rpcClient.call('provider:save', {
        config: { ...provider, enabled, updatedAt: Date.now() },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (apiKey) {
        await rpcClient.call('provider:save', {
          config: { ...provider, enabled: true, updatedAt: Date.now() },
          apiKey,
        });
      }
      const models = await rpcClient.call('provider:models', {
        providerId: provider.id,
      });
      return models;
    },
    onSuccess: (models) => {
      setTestResult(`Connected — ${models.length} models available`);
    },
    onError: (error: Error) => {
      setTestResult(`Failed: ${error.message}`);
    },
  });

  return (
    <div className="rounded-md border px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{provider.name}</p>
          <p className="text-xs text-muted-foreground">
            {provider.type === 'local' ? '🖥 Local' : '☁️ Cloud'} · {provider.adapterType}
            {provider.defaultModel && ` · ${provider.defaultModel}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`relative h-5 w-9 rounded-full transition-colors ${provider.enabled ? 'bg-primary' : 'bg-muted'}`}
            onClick={() => toggleMutation.mutate(!provider.enabled)}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${provider.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Configure'}
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div>
            <label className="text-xs text-muted-foreground">
              {provider.type === 'local'
                ? 'API Key (optional for local servers)'
                : 'API Key'}
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Default Model</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          {testResult && (
            <p className={`text-xs ${testResult.startsWith('Failed') ? 'text-red-400' : 'text-green-400'}`}>
              {testResult}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (provider.type === 'cloud' && !apiKey && !provider.enabled)}
            >
              Save & Enable
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              Test Connection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProviderSectionProps {
  providers: ProviderConfig[];
}

export function ProviderSection({ providers }: ProviderSectionProps) {
  const sorted = sortProvidersByBuiltinOrder(providers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers configured.</p>
        ) : (
          sorted.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Enable a provider and set it as default to start using AI actions.
        </p>
      </CardContent>
    </Card>
  );
}
