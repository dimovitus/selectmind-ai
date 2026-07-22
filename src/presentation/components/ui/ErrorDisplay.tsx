interface ErrorDisplayProps {
  error: string;
  onOpenSettings?: () => void;
  compact?: boolean;
}

const ERROR_HINTS: Record<string, { title: string; hint: string; action?: string }> = {
  'No AI provider configured': {
    title: 'No Provider Configured',
    hint: 'Add and enable an AI provider in Settings to start using actions.',
    action: 'Open Settings',
  },
  'Provider not enabled': {
    title: 'Provider Disabled',
    hint: 'Enable your AI provider in Settings.',
    action: 'Open Settings',
  },
  'API key is required': {
    title: 'API Key Missing',
    hint: 'Enter your API key in Settings → Providers.',
    action: 'Open Settings',
  },
  rate_limit: {
    title: 'Rate Limit',
    hint: 'Too many requests. Wait a moment and try again.',
  },
};

function parseError(error: string) {
  for (const [key, value] of Object.entries(ERROR_HINTS)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  if (error.includes('401') || error.includes('Unauthorized')) {
    return {
      title: 'Authentication Failed',
      hint: 'Check your API key in Settings.',
      action: 'Open Settings',
    };
  }
  if (error.includes('429')) {
    return ERROR_HINTS.rate_limit!;
  }
  return { title: 'Something went wrong', hint: error };
}

export function ErrorDisplay({ error, onOpenSettings, compact }: ErrorDisplayProps) {
  const parsed = parseError(error);

  return (
    <div className={`sw-error ${compact ? 'sw-error-compact' : ''}`}>
      <span className="sw-error-icon">⚠️</span>
      <div className="sw-error-content">
        <p className="sw-error-title">{parsed.title}</p>
        <p className="sw-error-hint">{parsed.hint}</p>
        {parsed.action && onOpenSettings && (
          <button type="button" className="sw-error-action" onClick={onOpenSettings}>
            {parsed.action}
          </button>
        )}
      </div>
    </div>
  );
}
