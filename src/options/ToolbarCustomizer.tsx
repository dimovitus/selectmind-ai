import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';
import type { Settings } from '@/shared/types/settings';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

interface ToolbarCustomizerProps {
  actions: Action[];
  settings: Settings;
}

export function ToolbarCustomizer({ actions, settings }: ToolbarCustomizerProps) {
  const queryClient = useQueryClient();
  const toolbarIds = settings.toolbarActionIds.length > 0
    ? settings.toolbarActionIds
    : actions.filter((a) => a.isEnabled).sort((a, b) => a.order - b.order).slice(0, settings.maxToolbarActions).map((a) => a.id);

  const actionMap = new Map(actions.map((a) => [a.id, a]));
  const toolbarActions = toolbarIds
    .map((id) => actionMap.get(id))
    .filter((a): a is Action => !!a);

  const availableActions = actions.filter(
    (a) => a.isEnabled && !toolbarIds.includes(a.id),
  );

  const saveToolbar = async (ids: ActionId[]) => {
    await rpcClient.call('settings:update', { toolbarActionIds: ids });
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...toolbarIds];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    void saveToolbar(next);
  };

  const moveDown = (index: number) => {
    if (index >= toolbarIds.length - 1) return;
    const next = [...toolbarIds];
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    void saveToolbar(next);
  };

  const remove = (id: ActionId) => {
    void saveToolbar(toolbarIds.filter((i) => i !== id));
  };

  const add = (id: ActionId) => {
    if (toolbarIds.length >= settings.maxToolbarActions) return;
    void saveToolbar([...toolbarIds, id]);
  };

  const resetMutation = useMutation({
    mutationFn: async () => rpcClient.call('settings:update', { toolbarActionIds: [] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Floating Toolbar</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => resetMutation.mutate()}>
          Reset to default
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Customize which actions appear in the floating toolbar (max {settings.maxToolbarActions}).
        </p>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Toolbar ({toolbarActions.length}/{settings.maxToolbarActions})
          </p>
          <div className="space-y-1">
            {toolbarActions.map((action, index) => (
              <div key={action.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span>{action.icon}</span>
                <span className="flex-1 text-sm">{action.name}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveUp(index)} disabled={index === 0}>↑</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveDown(index)} disabled={index === toolbarActions.length - 1}>↓</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => remove(action.id)}>×</Button>
                </div>
              </div>
            ))}
            {toolbarActions.length === 0 && (
              <p className="text-sm text-muted-foreground">No actions in toolbar</p>
            )}
          </div>
        </div>

        {availableActions.length > 0 && toolbarActions.length < settings.maxToolbarActions && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-accent"
                  onClick={() => add(action.id)}
                >
                  {action.icon} {action.name} +
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <div className="inline-flex items-center gap-1 rounded-lg border bg-zinc-900 p-1">
            {toolbarActions.map((action) => (
              <div
                key={action.id}
                className="flex h-8 w-8 items-center justify-center rounded-md text-base"
                title={action.name}
              >
                {action.icon}
              </div>
            ))}
            <div className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500">⋮</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
