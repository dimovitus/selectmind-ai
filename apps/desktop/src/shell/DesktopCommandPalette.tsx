import { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import type { Action } from '@/domain/action/action.schema';
import type { Pipeline } from '@/domain/provider/provider.schema';
import type { PageContext } from '@/shared/types/page-context';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { fuzzyFilter } from '@/shared/utils/fuzzy-search';
import { PRODUCT_NAME } from '@selectmind/shared';
import './command-palette.css';

export interface PaletteItem {
  id: string;
  type: 'action' | 'pipeline';
  icon: string;
  name: string;
  subtitle?: string;
  actionId?: Action['id'];
  pipelineId?: Pipeline['id'];
}

interface DesktopCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (item: PaletteItem, context: PageContext) => void;
}

export function DesktopCommandPalette({ open, onClose, onExecute }: DesktopCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    void Promise.all([
      rpcClient.call('action:list', undefined),
      rpcClient.call('pipeline:list', undefined),
    ]).then(([actions, pipelines]) => {
      const actionItems: PaletteItem[] = actions
        .filter((action) => action.isEnabled)
        .map((action) => ({
          id: action.id,
          type: 'action' as const,
          icon: action.icon,
          name: action.name,
          subtitle: action.outputMode,
          actionId: action.id,
        }));
      const pipelineItems: PaletteItem[] = pipelines.map((pipeline) => ({
        id: pipeline.id,
        type: 'pipeline' as const,
        icon: '🔗',
        name: pipeline.name,
        subtitle: `${pipeline.steps.length} steps`,
        pipelineId: pipeline.id,
      }));
      setItems([...actionItems, ...pipelineItems]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = fuzzyFilter(items, query, (item) => `${item.name} ${item.subtitle ?? ''}`);

  const handleSelect = useCallback(
    async (item: PaletteItem) => {
      const context = await rpcClient.call('context:get', undefined);
      if (!context.selection.trim()) {
        context.selection = context.pageTitle || 'Desktop workspace';
      }
      onExecute(item, context);
      onClose();
    },
    [onExecute, onClose],
  );

  if (!open) return null;

  return (
    <div className="saywa-palette-overlay" onClick={onClose}>
      <div className="saywa-palette" onClick={(event) => event.stopPropagation()}>
        <Command label={`${PRODUCT_NAME} Command Palette`} shouldFilter={false}>
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search actions and pipelines…"
            className="saywa-palette-input"
          />
          <Command.List className="saywa-palette-list">
            <Command.Empty className="saywa-palette-empty">No results found.</Command.Empty>
            {filtered.map((item) => (
              <Command.Item
                key={item.id}
                value={item.id}
                onSelect={() => void handleSelect(item)}
                className="saywa-palette-item"
              >
                <span className="saywa-palette-item-icon">{item.icon}</span>
                <div className="saywa-palette-item-text">
                  <span className="saywa-palette-item-name">{item.name}</span>
                  {item.subtitle ? (
                    <span className="saywa-palette-item-sub">{item.subtitle}</span>
                  ) : null}
                </div>
                <span className="saywa-palette-item-type">{item.type}</span>
              </Command.Item>
            ))}
          </Command.List>
          <div className="saywa-palette-footer">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
