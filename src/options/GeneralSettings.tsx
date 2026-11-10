import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { Settings } from '@/shared/types/settings';
import type { ActionId, ProviderId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import {
  RESPONSE_LANGUAGE_OPTIONS,
  type ResponseLanguageCode,
} from '@/shared/constants/response-languages';
import { SupportSection } from './SupportSection';

interface GeneralSettingsProps {
  settings: Settings;
  providers: ProviderConfig[];
  actions: Action[];
  onEditAction?: (action: Action) => void;
}

export function GeneralSettings({
  settings,
  providers,
  actions,
  onEditAction,
}: GeneralSettingsProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (partial: Partial<Settings>) => rpcClient.call('settings:update', partial),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const enabledProviders = providers.filter((p) => p.enabled);
  const screenshotAction = actions.find((action) => action.id === settings.screenshotActionId);
  const screenshotActionChoices = actions.filter(
    (action) => action.isEnabled || action.id === settings.screenshotActionId,
  );

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
              Applies to AI responses and built-in action names/prompts. Auto follows the
              selected text or browser language.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Screen capture / OCR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-end justify-between gap-2">
              <label className="text-xs text-muted-foreground">Action run by the OCR button</label>
              {screenshotAction && onEditAction && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    onEditAction(screenshotAction);
                  }}
                >
                  Edit prompt
                </button>
              )}
            </div>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.screenshotActionId}
              onChange={(e) => {
                updateMutation.mutate({ screenshotActionId: e.target.value as ActionId });
              }}
            >
              {screenshotActionChoices.length === 0 && (
                <option value={settings.screenshotActionId}>No enabled actions</option>
              )}
              {screenshotActionChoices.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.icon} {action.name}
                  {action.isEnabled ? '' : ' (disabled)'}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              The 📸 OCR button and <kbd>Ctrl+Shift+X</kbd> run this action on the captured
              region. Use <code>{'{{screenshot_ocr}}'}</code> in the prompt to pass in the
              recognized text.
            </p>
            {screenshotAction && !screenshotAction.isEnabled && (
              <p className="mt-1.5 text-xs text-amber-400">
                This action is disabled. The OCR button will use “Explain screenshot” until you
                enable it.
              </p>
            )}
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
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.showFloatingToolbar ? 'translate-x-4' : 'translate-x-0.5'}`}
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
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.enableStreaming ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Save conversations to sidebar history</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${settings.saveConversationHistory ? 'bg-primary' : 'bg-muted'}`}
              onClick={() =>
                updateMutation.mutate({ saveConversationHistory: !settings.saveConversationHistory })
              }
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.saveConversationHistory ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          <p className="text-xs text-muted-foreground">
            When off, chats still work in popups but are removed from the side panel after you close
            them. Opening a chat in the workspace keeps it in history.
          </p>
          {settings.saveConversationHistory && (
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
          )}
        </CardContent>
      </Card>

      <SupportSection />
    </div>
  );
}
