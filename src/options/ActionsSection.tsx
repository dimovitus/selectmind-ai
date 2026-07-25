import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

interface ActionsSectionProps {
  actions: Action[];
  categories: Category[];
  onCreateCustom: () => void;
  onEditAction: (action: Action) => void;
  onDuplicateAction: (action: Action) => void;
}

export function ActionsSection({
  actions,
  categories,
  onCreateCustom,
  onEditAction,
  onDuplicateAction,
}: ActionsSectionProps) {
  const [filter, setFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const customActions = actions.filter((a) => !a.isBuiltIn);
  const toggleMutation = useMutation({
    mutationFn: async (action: Action) => {
      return rpcClient.call('action:save', {
        action: { ...action, isEnabled: !action.isEnabled, updatedAt: Date.now() },
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });

  const filtered =
    filter === 'all'
      ? actions
      : filter === 'custom'
        ? customActions
        : actions.filter((a) => a.categoryId === filter);

  const grouped = categories
    .map((cat) => ({
      category: cat,
      actions: filtered.filter(
        (a) => a.categoryId === cat.id && (filter !== 'all' || a.isBuiltIn),
      ),
    }))
    .filter((g) => g.actions.length > 0);

  const renderActionRow = (action: Action) => (
    <div key={action.id} className="flex items-center justify-between rounded-md border px-3 py-2">
      <button
        type="button"
        className="flex flex-1 items-center gap-3 text-left"
        onClick={() => onEditAction(action)}
      >
        <span>{action.icon}</span>
        <div>
          <p className="text-sm font-medium">{action.name}</p>
          <p className="text-xs text-muted-foreground">
            {action.outputMode}
            {action.isBuiltIn ? ' · built-in' : ' · custom'}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-2">
        {action.isBuiltIn && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onDuplicateAction(action)}>
            Duplicate
          </Button>
        )}
        <button
          type="button"
          className={`h-5 w-9 rounded-full transition-colors ${action.isEnabled ? 'bg-primary' : 'bg-muted'}`}
          onClick={() => toggleMutation.mutate(action)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white transition-transform ${action.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Actions Library</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your own prompts or duplicate built-in actions as editable customs.
          </p>
        </div>
        <Button size="sm" onClick={onCreateCustom}>
          + Custom prompt
        </Button>
      </CardHeader>
      <CardContent>
        {customActions.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              My custom prompts ({customActions.length})
            </p>
            <div className="space-y-1">{customActions.map(renderActionRow)}</div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setFilter('all')}
          >
            All ({actions.length})
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${filter === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setFilter('custom')}
          >
            Custom ({customActions.length})
          </button>
          {categories.map((cat) => {
            const count = actions.filter((a) => a.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${filter === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                onClick={() => setFilter(cat.id)}
              >
                {cat.icon} {cat.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {filter === 'custom' ? (
            customActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom prompts yet. Click “+ Custom prompt” to create one.
              </p>
            ) : (
              <div className="space-y-1">{customActions.map(renderActionRow)}</div>
            )
          ) : (
            (filter === 'all' ? grouped : [{ category: categories.find((c) => c.id === filter)!, actions: filtered }])
              .filter((g) => g.category)
              .map(({ category, actions: catActions }) => (
                <div key={category.id}>
                  {filter === 'all' && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {category.icon} {category.name}
                    </p>
                  )}
                  <div className="space-y-1">{catActions.map(renderActionRow)}</div>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
