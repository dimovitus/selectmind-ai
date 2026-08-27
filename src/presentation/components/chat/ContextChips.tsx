import type { ContextBundle, ContextFragment } from '@/domain/conversation/conversation.schema';
import { createContextFragmentId } from '@/domain/shared/ids';

interface ContextChip {
  id: string;
  icon: string;
  label: string;
  preview: string;
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildChips(bundle: ContextBundle): ContextChip[] {
  const chips: ContextChip[] = [];

  if (bundle.selection) {
    chips.push({
      id: 'selection',
      icon: '✂️',
      label: 'Selection',
      preview: truncate(bundle.selection),
    });
  }

  if (bundle.screenshot) {
    chips.push({
      id: 'screenshot',
      icon: '📸',
      label: 'Screenshot',
      preview: `${bundle.screenshot.width}×${bundle.screenshot.height}${bundle.screenshot.ocrText ? ` · ${truncate(bundle.screenshot.ocrText, 40)}` : ''}`,
    });
  }

  if (bundle.pageTitle) {
    chips.push({
      id: 'page',
      icon: '📄',
      label: bundle.pageTitle,
      preview: bundle.url ?? '',
    });
  }

  for (const fragment of bundle.customFragments) {
    chips.push({
      id: fragment.id,
      icon: '📎',
      label: fragment.label,
      preview: truncate(fragment.content),
    });
  }

  return chips;
}

interface ContextChipsProps {
  bundle: ContextBundle;
  onAddContext?: () => void;
  compact?: boolean;
}

export function ContextChips({ bundle, onAddContext, compact }: ContextChipsProps) {
  const chips = buildChips(bundle);

  if (chips.length === 0 && !onAddContext) return null;

  return (
    <div className={`sw-context ${compact ? 'sw-context-compact' : ''}`}>
      <div className="sw-context-chips">
        {chips.map((chip) => (
          <div key={chip.id} className="sw-context-chip" title={`${chip.label}: ${chip.preview}`}>
            <span className="sw-context-chip-icon">{chip.icon}</span>
            <span className="sw-context-chip-label">{chip.label}</span>
            {!compact && <span className="sw-context-chip-preview">{chip.preview}</span>}
          </div>
        ))}
      </div>
      {onAddContext && (
        <button type="button" className="sw-context-add" onClick={onAddContext}>
          + Add selection
        </button>
      )}
    </div>
  );
}

export function createContextFragment(
  label: string,
  content: string,
): ContextFragment {
  return {
    id: createContextFragmentId(),
    label,
    content,
    addedAt: Date.now(),
  };
}
