import { useQuery } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';

export function PipelinesSection() {
  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => rpcClient.call('pipeline:list', undefined),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipelines</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Multi-step AI workflows. Run from Command Palette (Ctrl+Shift+P).
        </p>
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">🔗 {pipeline.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pipeline.steps.length} steps · {pipeline.finalOutputMode}
                    {pipeline.isBuiltIn && ' · built-in'}
                  </p>
                </div>
              </div>
              <ol className="mt-2 space-y-1 border-t pt-2">
                {[...pipeline.steps]
                  .sort((a, b) => a.order - b.order)
                  .map((step, i) => (
                    <li key={step.id} className="text-xs text-muted-foreground">
                      {i + 1}. {step.actionId ? `Action: ${step.actionId}` : (step.prompt?.slice(0, 60) ?? 'Step') + '…'}
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
