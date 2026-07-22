import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import type { ProviderConfig } from '@/domain/provider/provider.schema';
import { createActionId, now } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { TEMPLATE_VARIABLES, OUTPUT_MODES } from '@/shared/constants/template-variables';

interface ActionEditorProps {
  action?: Action | null;
  categories: Category[];
  providers: ProviderConfig[];
  onClose: () => void;
}

const EMPTY_FORM = {
  name: '',
  icon: '⚡',
  categoryId: '',
  prompt: '{{selection}}',
  providerId: '',
  model: '',
  temperature: 0.7,
  streaming: true,
  outputMode: 'popup' as Action['outputMode'],
  isEnabled: true,
  hotkey: '',
};

export function ActionEditor({ action, categories, providers, onClose }: ActionEditorProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();
  const isEditing = !!action;

  useEffect(() => {
    if (action) {
      setForm({
        name: action.name,
        icon: action.icon,
        categoryId: action.categoryId,
        prompt: action.prompt,
        providerId: action.providerId ?? '',
        model: action.model ?? '',
        temperature: action.temperature,
        streaming: action.streaming,
        outputMode: action.outputMode,
        isEnabled: action.isEnabled,
        hotkey: action.hotkey ?? '',
      });
    } else if (categories[0]) {
      setForm((f) => ({ ...f, categoryId: categories[0]!.id }));
    }
  }, [action, categories]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const timestamp = now();
      const toSave: Action = {
        id: action?.id ?? createActionId(),
        name: form.name.trim(),
        icon: form.icon.trim() || '⚡',
        categoryId: form.categoryId as Action['categoryId'],
        prompt: form.prompt.trim(),
        providerId: form.providerId ? (form.providerId as Action['providerId']) : undefined,
        model: form.model.trim() || undefined,
        temperature: form.temperature,
        streaming: form.streaming,
        outputMode: form.outputMode,
        isBuiltIn: action?.isBuiltIn ?? false,
        isEnabled: form.isEnabled,
        order: action?.order ?? 999,
        hotkey: form.hotkey.trim() || undefined,
        createdAt: action?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      return rpcClient.call('action:save', { action: toSave });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['actions'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!action) return;
      return rpcClient.call('action:delete', { actionId: action.id });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['actions'] });
      onClose();
    },
  });

  const insertVariable = (varName: string) => {
    setForm((f) => ({ ...f, prompt: `${f.prompt}{{${varName}}}` }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{isEditing ? 'Edit Action' : 'New Action'}</h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Explain"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Icon (emoji)</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="🧠"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Output Mode</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.outputMode}
              onChange={(e) => setForm((f) => ({ ...f, outputMode: e.target.value as Action['outputMode'] }))}
            >
              {OUTPUT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Hotkey (e.g. Ctrl+Shift+E)</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.hotkey}
              onChange={(e) => setForm((f) => ({ ...f, hotkey: e.target.value }))}
              placeholder="Ctrl+Shift+E"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-muted-foreground">Prompt Template</label>
          <textarea
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            rows={6}
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                title={v.description}
                onClick={() => insertVariable(v.name)}
              >
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Provider (optional)</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.providerId}
              onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
            >
              <option value="">Default</option>
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Model (optional)</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Temperature ({form.temperature})</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              className="mt-2 w-full"
              value={form.temperature}
              onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.streaming}
              onChange={(e) => setForm((f) => ({ ...f, streaming: e.target.checked }))}
            />
            Streaming
          </label>
        </div>

        <div className="mt-6 flex justify-between">
          <div>
            {isEditing && !action.isBuiltIn && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 hover:text-red-300"
                onClick={() => {
                  if (confirm('Delete this action?')) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || !form.prompt.trim() || saveMutation.isPending}
            >
              {isEditing ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
