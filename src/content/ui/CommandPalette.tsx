import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import type { Action } from '@/domain/action/action.schema';
import type { Pipeline } from '@/domain/provider/provider.schema';
import type { PageContext } from '@/shared/types/page-context';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { fuzzyFilter } from '@/shared/utils/fuzzy-search';
import { extractPageContext } from '@/content/page-context-extractor';
import { PRODUCT_NAME } from '@/shared/constants/brand';

interface PaletteItem {
  id: string;
  type: 'action' | 'pipeline';
  icon: string;
  name: string;
  subtitle?: string;
  actionId?: Action['id'];
  pipelineId?: Pipeline['id'];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (item: PaletteItem, context: PageContext) => void;
}

export function CommandPalette({ open, onClose, onExecute }: CommandPaletteProps) {
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
        .filter((a) => a.isEnabled)
        .map((a) => ({
          id: a.id,
          type: 'action' as const,
          icon: a.icon,
          name: a.name,
          subtitle: a.outputMode,
          actionId: a.id,
        }));
      const pipelineItems: PaletteItem[] = pipelines.map((p) => ({
        id: p.id,
        type: 'pipeline' as const,
        icon: '🔗',
        name: p.name,
        subtitle: `${p.steps.length} steps`,
        pipelineId: p.id,
      }));
      setItems([...actionItems, ...pipelineItems]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = fuzzyFilter(items, query, (item) => `${item.name} ${item.subtitle ?? ''}`);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      const context = extractPageContext();
      if (!context.selection.trim()) {
        context.selection = context.pageTitle || 'No selection';
      }
      onExecute(item, context);
      onClose();
    },
    [onExecute, onClose],
  );

  if (!open) return null;

  return (
    <div className="saywa-palette-overlay" onClick={onClose}>
      <div className="saywa-palette" onClick={(e) => e.stopPropagation()}>
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
                onSelect={() => handleSelect(item)}
                className="saywa-palette-item"
              >
                <span className="saywa-palette-item-icon">{item.icon}</span>
                <div className="saywa-palette-item-text">
                  <span className="saywa-palette-item-name">{item.name}</span>
                  {item.subtitle && (
                    <span className="saywa-palette-item-sub">{item.subtitle}</span>
                  )}
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
