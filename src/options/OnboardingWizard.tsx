import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import type { ProviderConfig } from '@/domain/provider/provider.schema';

interface OnboardingWizardProps {
  providers: ProviderConfig[];
  onComplete: () => void;
  variant?: 'extension' | 'desktop';
}

export function OnboardingWizard({
  providers,
  onComplete,
  variant = 'extension',
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState(providers[0]?.id ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(providers[0]?.defaultModel ?? '');
  const queryClient = useQueryClient();

  const selected = providers.find((p) => p.id === selectedProvider);
  const needsKey = selected?.type === 'cloud';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a provider');

      await rpcClient.call('provider:save', {
        config: {
          ...selected,
          enabled: true,
          defaultModel: model || selected.defaultModel,
          updatedAt: Date.now(),
        },
        apiKey: needsKey ? apiKey.trim() : undefined,
      });

      await rpcClient.call('settings:update', {
        defaultProviderId: selected.id,
        defaultModel: model || selected.defaultModel,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setStep(2);
    },
  });

  const finish = async () => {
    await rpcClient.call('settings:update', { onboardingCompleted: true });
    void queryClient.invalidateQueries();
    onComplete();
  };

  const steps =
    variant === 'desktop'
      ? [
          {
            title: 'Welcome to SelectMind AI 🧠',
            body: 'Capture any screen region with Ctrl+Shift+X, then ask AI to explain. Press Ctrl+Shift+P for the command palette.',
          },
          {
            title: 'Connect an AI Provider',
            body: 'Choose a provider and enter your API key. Ollama works locally without a key.',
          },
          {
            title: "You're Ready!",
            body: 'Use the OCR button or hotkey to capture screen text. Run actions and pipelines from Settings or the command palette.',
          },
        ]
      : [
          {
            title: 'Welcome to SelectMind AI 🧠',
            body: 'Turn any webpage into an AI-powered workspace. Select text, use the floating toolbar, or press Ctrl+Shift+P.',
          },
          {
            title: 'Connect an AI Provider',
            body: 'Choose a provider and enter your API key. Ollama works locally without a key.',
          },
          {
            title: "You're Ready!",
            body: 'Select text on any page and click 🧠 Explain. Use Ctrl+Shift+P for the Command Palette.',
          },
        ];

  const current = steps[step]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold">{current.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>

        {step === 1 && (
          <div className="mt-6 space-y-3">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                const p = providers.find((pr) => pr.id === e.target.value);
                setModel(p?.defaultModel ?? '');
              }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>

            {needsKey && (
              <input
                type="password"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="API key (Gemini: AIza… · OpenAI: sk-…)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            )}

            {saveMutation.isError ? (
              <p className="text-sm text-red-400">
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : 'Failed to save provider settings'}
              </p>
            ) : null}

            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Model (optional)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
        )}

        <div className="mt-8 flex justify-between gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void finish()}>
              Skip
            </Button>
          )}

          {step === 0 && <Button onClick={() => setStep(1)}>Next</Button>}

          {step === 1 && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (needsKey && !apiKey)}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save & Continue'}
            </Button>
          )}

          {step === 2 && (
            <Button onClick={() => void finish()}>Get Started</Button>
          )}
        </div>
      </div>
    </div>
  );
}
