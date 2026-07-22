import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { ActionEditor } from './ActionEditor';

interface ActionsSectionProps {
  actions: Action[];
  categories: Category[];
  providers: import('@/domain/provider/provider.schema').ProviderConfig[];
}

export function ActionsSection({ actions, categories, providers }: ActionsSectionProps) {
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Action | null | 'new'>(null);
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async (action: Action) => {
      return rpcClient.call('action:save', {
        action: { ...action, isEnabled: !action.isEnabled, updatedAt: Date.now() },
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });

  const filtered = filter === 'all'
    ? actions
    : actions.filter((a) => a.categoryId === filter);

  const grouped = categories
    .map((cat) => ({
      category: cat,
      actions: filtered.filter((a) => a.categoryId === cat.id),
    }))
    .filter((g) => g.actions.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Actions Library</CardTitle>
          <Button size="sm" onClick={() => setEditing('new')}>+ New Action</Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setFilter('all')}
            >
              All ({actions.length})
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
            {(filter === 'all' ? grouped : [{ category: categories.find((c) => c.id === filter)!, actions: filtered }])
              .filter((g) => g.category)
              .map(({ category, actions: catActions }) => (
                <div key={category.id}>
                  {filter === 'all' && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {category.icon} {category.name}
                    </p>
                  )}
                  <div className="space-y-1">
                    {catActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <button
                          type="button"
                          className="flex flex-1 items-center gap-3 text-left"
                          onClick={() => setEditing(action)}
                        >
                          <span>{action.icon}</span>
                          <div>
                            <p className="text-sm font-medium">{action.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {action.outputMode}
                              {action.isBuiltIn && ' · built-in'}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`ml-2 h-5 w-9 rounded-full transition-colors ${action.isEnabled ? 'bg-primary' : 'bg-muted'}`}
                          onClick={() => toggleMutation.mutate(action)}
                        >
                          <span
                            className={`block h-4 w-4 rounded-full bg-white transition-transform ${action.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {editing !== null && (
        <ActionEditor
          action={editing === 'new' ? null : editing}
          categories={categories}
          providers={providers}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
