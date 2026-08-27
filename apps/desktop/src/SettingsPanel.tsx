import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { ImportExportSection } from '@/options/ImportExportSection';
import { PipelinesSection } from '@/options/PipelinesSection';
import { ToolbarCustomizer } from '@/options/ToolbarCustomizer';
import { DesktopActionsSettings } from './settings/DesktopActionsSettings';
import { DesktopGeneralSettings } from './settings/DesktopGeneralSettings';
import { DesktopProviderSettings } from './settings/DesktopProviderSettings';

type SettingsTab = 'general' | 'providers' | 'actions' | 'toolbar' | 'pipelines' | 'backup';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'actions', label: 'Actions' },
  { id: 'toolbar', label: 'Toolbar' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'backup', label: 'Backup' },
];

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>('general');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => rpcClient.call('settings:get', undefined),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => rpcClient.call('provider:list', undefined),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['actions'],
    queryFn: () => rpcClient.call('action:list', undefined),
  });

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure AI providers, actions, pipelines, appearance, and desktop behavior.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'general' && settings ? (
          <DesktopGeneralSettings settings={settings} providers={providers} />
        ) : null}
        {tab === 'providers' ? <DesktopProviderSettings /> : null}
        {tab === 'actions' ? <DesktopActionsSettings /> : null}
        {tab === 'toolbar' && settings ? (
          <ToolbarCustomizer
            actions={actions}
            settings={settings}
            onCreateCustom={() => setTab('actions')}
          />
        ) : null}
        {tab === 'pipelines' ? <PipelinesSection /> : null}
        {tab === 'backup' ? <ImportExportSection /> : null}
      </div>
    </div>
  );
}
