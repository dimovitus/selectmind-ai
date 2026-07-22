import { useRef, useEffect, type KeyboardEvent } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAddContext?: () => void;
  disabled?: boolean;
  placeholder?: string;
  addContextTitle?: string;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  onAddContext,
  disabled,
  placeholder = 'Ask a follow-up…',
  addContextTitle = 'Add current selection to context',
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="sw-input-area">
      {onAddContext && (
        <button
          type="button"
          className="sw-input-add-context"
          onClick={onAddContext}
          title={addContextTitle}
        >
          📎
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="sw-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        type="button"
        className="sw-input-send"
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        ↑
      </button>
    </div>
  );
}
