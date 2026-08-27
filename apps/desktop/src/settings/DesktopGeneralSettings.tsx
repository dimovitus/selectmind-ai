import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { Settings } from '@/shared/types/settings';
import type { ProviderId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import {
  RESPONSE_LANGUAGE_OPTIONS,
  type ResponseLanguageCode,
} from '@/shared/constants/response-languages';
import { SupportSection } from '@/options/SupportSection';
import { DesktopLiveTranslateSettings } from './DesktopLiveTranslateSettings';
import { Button } from '@/presentation/components/ui/button';
import { AppSelect } from '@/presentation/components/ui/select';
import {
  DESKTOP_HOTKEY_DEFINITIONS,
  resetAllHotkeyBindings,
} from './desktop-hotkeys';
import { HotkeyRecorderField } from './HotkeyRecorderField';
import { syncDesktopHotkeys } from '../shell/init-desktop-hotkeys';
import {
  readDesktopExtras,
  writeDesktopExtras,
  type DesktopExtraSettings,
  type OcrEngine,
} from './desktop-extras';
import { syncSelectionMonitorSetting } from '../selection/init-selection-monitor';
import { setLaunchAtStartup } from '../shell/sync-autostart';
import { getDesktopOs, type DesktopOs } from '../platform/os';

interface DesktopGeneralSettingsProps {
  settings: Settings;
  providers: ProviderConfig[];
}

export function DesktopGeneralSettings({ settings, providers }: DesktopGeneralSettingsProps) {
  const queryClient = useQueryClient();
  const [extras, setExtras] = useState<DesktopExtraSettings>(() => readDesktopExtras());
  const [windowsOcrAvailable, setWindowsOcrAvailable] = useState<boolean | null>(null);
  const [desktopOs, setDesktopOs] = useState<DesktopOs | null>(null);

  useEffect(() => {
    void invoke<boolean>('ocr_is_available')
      .then(setWindowsOcrAvailable)
      .catch(() => setWindowsOcrAvailable(false));
    void getDesktopOs().then(setDesktopOs);
  }, []);

  const updateMutation = useMutation({
    mutationFn: (partial: Partial<Settings>) => rpcClient.call('settings:update', partial),
    onSuccess: (_data, partial) => {
      if (partial.showFloatingToolbar !== undefined) {
        void syncSelectionMonitorSetting();
      }
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const enabledProviders = providers.filter((provider) => provider.enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Provider</label>
            <AppSelect
              className="mt-1"
              aria-label="Default AI provider"
              value={settings.defaultProviderId ?? ''}
              onChange={(nextId) =>
                updateMutation.mutate({
                  defaultProviderId: (nextId || null) as ProviderId | null,
                })
              }
              options={[
                { value: '', label: 'Not set' },
                ...enabledProviders.map((provider) => ({
                  value: provider.id,
                  label: provider.name,
                })),
              ]}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Default Model</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.defaultModel ?? ''}
              onChange={(event) =>
                updateMutation.mutate({ defaultModel: event.target.value || null })
              }
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
            <AppSelect
              className="mt-1"
              aria-label="Theme"
              value={settings.theme}
              onChange={(nextTheme) =>
                updateMutation.mutate({ theme: nextTheme as Settings['theme'] })
              }
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
            />
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
            <AppSelect
              className="mt-1"
              aria-label="Preferred response language"
              value={settings.responseLanguage ?? 'auto'}
              onChange={(nextLanguage) =>
                updateMutation.mutate({
                  responseLanguage: nextLanguage as ResponseLanguageCode,
                })
              }
              options={RESPONSE_LANGUAGE_OPTIONS.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Applies to AI responses and built-in action names/prompts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System tray</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            SelectMind keeps running in the notification area so global hotkeys, text selection toolbar,
            and screen capture stay available. Left-click the tray icon to restore the window.
          </p>
          <label className="flex items-center justify-between text-sm">
            <span>Close button → hide to tray</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${extras.closeToTray ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => setExtras(writeDesktopExtras({ closeToTray: !extras.closeToTray }))}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${extras.closeToTray ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Minimize button → hide to tray</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${extras.minimizeToTray ? 'bg-primary' : 'bg-muted'}`}
              onClick={() =>
                setExtras(writeDesktopExtras({ minimizeToTray: !extras.minimizeToTray }))
              }
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${extras.minimizeToTray ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          {!extras.closeToTray ? (
            <p className="text-xs text-amber-400">
              With this off, closing the window quits SelectMind (hotkeys and selection toolbar stop).
            </p>
          ) : null}
          <label className="flex items-center justify-between text-sm">
            <span>Launch at login (hidden in tray)</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${extras.launchAtStartup ? 'bg-primary' : 'bg-muted'}`}
              onClick={() => {
                void setLaunchAtStartup(!extras.launchAtStartup).then(setExtras);
              }}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${extras.launchAtStartup ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Click a shortcut to record a new combination. At least one modifier (Ctrl, Alt, Shift,
            Meta) is required. Changes apply immediately.
          </p>
          {DESKTOP_HOTKEY_DEFINITIONS.map((definition) => (
            <HotkeyRecorderField key={definition.id} hotkeyId={definition.id} />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetAllHotkeyBindings();
              void syncDesktopHotkeys();
            }}
          >
            Reset all shortcuts to defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desktop behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>Show floating toolbar on text selection</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${settings.showFloatingToolbar ? 'bg-primary' : 'bg-muted'}`}
              onClick={() =>
                updateMutation.mutate({ showFloatingToolbar: !settings.showFloatingToolbar })
              }
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.showFloatingToolbar ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          {desktopOs === 'linux' ? (
            <p className="text-xs text-muted-foreground">
              Linux does not auto-detect text selection. Use the toolbar hotkey
              (default Ctrl+Shift+Space) — it copies the selection and shows the popup.
            </p>
          ) : null}
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
          <label className="flex items-center justify-between text-sm">
            <span>Save conversation history</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${settings.saveConversationHistory ? 'bg-primary' : 'bg-muted'}`}
              onClick={() =>
                updateMutation.mutate({
                  saveConversationHistory: !settings.saveConversationHistory,
                })
              }
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.saveConversationHistory ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
          {settings.saveConversationHistory ? (
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
                onChange={(event) =>
                  updateMutation.mutate({
                    conversationRetentionDays: parseInt(event.target.value, 10),
                  })
                }
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs text-muted-foreground">OCR engine</label>
            <AppSelect
              className="mt-1"
              aria-label="OCR engine"
              value={desktopOs === 'linux' && extras.ocrEngine === 'windows' ? 'auto' : extras.ocrEngine}
              onChange={(nextEngine) =>
                setExtras(writeDesktopExtras({ ocrEngine: nextEngine as OcrEngine }))
              }
              options={[
                {
                  value: 'auto',
                  label:
                    desktopOs === 'linux'
                      ? 'Auto (Tesseract CLI → Tesseract.js fallback)'
                      : 'Auto (Windows OCR → Tesseract fallback)',
                },
                ...(desktopOs === 'linux' ? [] : [{ value: 'windows', label: 'Windows OCR only' }]),
                { value: 'tesseract', label: 'Tesseract.js only' },
              ]}
            />
            {desktopOs === 'linux' && windowsOcrAvailable === false ? (
              <p className="mt-1.5 text-xs text-amber-400">
                Tesseract CLI is not on PATH. Install <code>tesseract</code> and language packs
                (e.g. <code>tesseract-data-eng</code>, <code>tesseract-data-rus</code>) or use
                Tesseract.js.
              </p>
            ) : null}
            {desktopOs !== 'linux' && windowsOcrAvailable === false ? (
              <p className="mt-1.5 text-xs text-amber-400">
                Windows OCR is unavailable on this system — Auto/Tesseract will be used.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gaming &amp; screen capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              SelectMind uses a transparent overlay and OS screen APIs — it does not inject into
              games or modify game memory.
            </li>
            <li>
              Exclusive fullscreen may block capture. Prefer <strong className="text-foreground">borderless windowed</strong> mode when possible.
            </li>
            <li>
              While gaming, turn off <strong className="text-foreground">Show floating toolbar on text selection</strong>{' '}
              above — auto-detection polls the foreground window and can reduce FPS in 3D games.
              Use <strong className="text-foreground">Ctrl+Shift+O</strong> (OCR toolbar) or{' '}
              <strong className="text-foreground">Ctrl+Shift+Space</strong> (manual toolbar) instead.
            </li>
            <li>
              Some anti-cheat tools may flag global hotkeys or screen capture. Use at your own
              risk in competitive titles.
            </li>
          </ul>
          <label className="flex items-center justify-between text-sm text-foreground">
            <span>I understand these limitations</span>
            <button
              type="button"
              className={`relative h-5 w-9 rounded-full transition-colors ${extras.captureDisclaimerAccepted ? 'bg-primary' : 'bg-muted'}`}
              onClick={() =>
                setExtras(
                  writeDesktopExtras({
                    captureDisclaimerAccepted: !extras.captureDisclaimerAccepted,
                  }),
                )
              }
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${extras.captureDisclaimerAccepted ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Provider API keys are stored in the Windows Credential Manager, not in plain text
            files.
          </p>
        </CardContent>
      </Card>

      <DesktopLiveTranslateSettings />

      <SupportSection />
    </div>
  );
}
