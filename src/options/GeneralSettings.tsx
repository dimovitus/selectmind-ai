import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { Settings } from '@/shared/types/settings';
import type { ProviderId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import {
  RESPONSE_LANGUAGE_OPTIONS,
  type ResponseLanguageCode,
} from '@/shared/constants/response-languages';

interface GeneralSettingsProps {
  settings: Settings;
  providers: ProviderConfig[];
}

export function GeneralSettings({ settings, providers }: GeneralSettingsProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (partial: Partial<Settings>) => rpcClient.call('settings:update', partial),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const enabledProviders = providers.filter((p) => p.enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.defaultProviderId ?? ''}
              onChange={(e) =>
                updateMutation.mutate({
                  defaultProviderId: (e.target.value || null) as ProviderId | null,
                })
              }
            >
              <option value="">Not set</option>
              {enabledProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Default Model</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.defaultModel ?? ''}
              onChange={(e) => updateMutation.mutate({ defaultModel: e.target.value || null })}
              placeholder="gpt-4o-mini"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Theme</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.theme}
              onChange={(e) =>
                updateMutation.mutate({ theme: e.target.value as Settings['theme'] })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Preferred response language</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.responseLanguage ?? 'auto'}
              onChange={(e) =>
                updateMutation.mutate({
                  responseLanguage: e.target.value as ResponseLanguageCode,
                })
              }
            >
              {RESPONSE_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Applies to Explain, Chat, and other AI responses. Auto follows the selected text
              language.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>Show floating toolbar on text selection</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${settings.showFloatingToolbar ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => updateMutation.mutate({ showFloatingToolbar: !settings.showFloatingToolbar })}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.showFloatingToolbar ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Enable streaming responses</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${settings.enableStreaming ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => updateMutation.mutate({ enableStreaming: !settings.enableStreaming })}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.enableStreaming ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          <div>
            <label className="text-xs text-muted-foreground">
              Conversation retention ({settings.conversationRetentionDays} days)
            </label>
            <input
              type="range"
              min={7}
              max={365}
              step={1}
              className="mt-2 w-full"
              value={settings.conversationRetentionDays}
              onChange={(e) =>
                updateMutation.mutate({ conversationRetentionDays: parseInt(e.target.value, 10) })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
