import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { useTheme } from '@/presentation/hooks/useTheme';
import { ProviderSection } from './ProviderSection';
import { ActionsSection } from './ActionsSection';
import { CategoryManager } from './CategoryManager';
import { ToolbarCustomizer } from './ToolbarCustomizer';
import { GeneralSettings } from './GeneralSettings';
import { PipelinesSection } from './PipelinesSection';
import { ImportExportSection } from './ImportExportSection';
import { OnboardingWizard } from './OnboardingWizard';
import { PRODUCT_NAME } from '@/shared/constants/brand';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

type Tab = 'general' | 'providers' | 'actions' | 'toolbar' | 'categories' | 'pipelines' | 'backup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'providers', label: 'Providers', icon: '☁️' },
  { id: 'actions', label: 'Actions', icon: '⚡' },
  { id: 'toolbar', label: 'Toolbar', icon: '🛠' },
  { id: 'pipelines', label: 'Pipelines', icon: '🔗' },
  { id: 'categories', label: 'Categories', icon: '📁' },
  { id: 'backup', label: 'Backup', icon: '💾' },
];

function OptionsContent() {
  const [tab, setTab] = useState<Tab>('general');
  const [showOnboarding, setShowOnboarding] = useState(true);

  const { data: actions = [] } = useQuery({
    queryKey: ['actions'],
    queryFn: () => rpcClient.call('action:list', undefined),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => rpcClient.call('category:list', undefined),
  });

  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => rpcClient.call('settings:get', undefined),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => rpcClient.call('provider:list', undefined),
  });

  const { data: ping } = useQuery({
    queryKey: ['ping'],
    queryFn: () => rpcClient.call('ping', undefined),
  });

  useTheme(settings?.theme ?? 'dark');

  if (settingsError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium">Could not connect to {PRODUCT_NAME}</p>
        <p className="text-sm text-muted-foreground">
          Reload the extension at chrome://extensions and try again.
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  const needsOnboarding = showOnboarding && !settings.onboardingCompleted;

  return (
    <div className="min-h-screen">
      {needsOnboarding && (
        <OnboardingWizard
          providers={providers}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      <header className="border-b px-8 py-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h1 className="text-2xl font-bold">{PRODUCT_NAME} Settings</h1>
            <p className="text-sm text-muted-foreground">
              {ping ? 'Connected' : 'Connecting…'} · {actions.length} actions · {providers.filter((p) => p.enabled).length} providers active
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-8 pt-4">
        <nav className="flex gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 p-8">
        {tab === 'general' && (
          <GeneralSettings settings={settings} providers={providers} />
        )}
        {tab === 'providers' && (
          <ProviderSection providers={providers} />
        )}
        {tab === 'actions' && (
          <ActionsSection actions={actions} categories={categories} providers={providers} />
        )}
        {tab === 'toolbar' && (
          <ToolbarCustomizer actions={actions} settings={settings} />
        )}
        {tab === 'categories' && (
          <CategoryManager categories={categories} />
        )}
        {tab === 'pipelines' && <PipelinesSection />}
        {tab === 'backup' && <ImportExportSection />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OptionsContent />
    </QueryClientProvider>
  );
}
