import { useEffect, useRef, useMemo, useCallback } from 'react';
import { marked, type RendererObject } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import katex from 'katex';
import 'katex/dist/katex.min.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMath(text: string): string {
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="math-error">${escapeHtml(tex)}</span>`;
    }
  });
  result = result.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_m, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="math-error">${escapeHtml(tex)}</span>`;
    }
  });
  return result;
}

const renderer: RendererObject = {
  code({ text, lang }) {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined;
    const highlighted = language
      ? hljs.highlight(text, { language }).value
      : escapeHtml(text);
    const langLabel = language ?? 'text';
    const encoded = encodeURIComponent(text);

    return `<div class="sw-code-block" data-code="${encoded}">
      <div class="sw-code-header">
        <span class="sw-code-lang">${langLabel}</span>
        <button type="button" class="sw-code-copy" data-action="copy-code">Copy</button>
      </div>
      <pre><code class="hljs language-${langLabel}">${highlighted}</code></pre>
    </div>`;
  },
};

marked.use({ renderer, breaks: true, gfm: true });

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!content) return '';
    return marked.parse(renderMath(content)) as string;
  }, [content]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.dataset.action === 'copy-code') {
      const block = target.closest('.sw-code-block');
      const encoded = block?.getAttribute('data-code');
      if (encoded) {
        void navigator.clipboard.writeText(decodeURIComponent(encoded));
        target.textContent = 'Copied!';
        setTimeout(() => {
          target.textContent = 'Copy';
        }, 1500);
      }
    }
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll('pre code').forEach((block) => {
      if (!block.classList.contains('hljs')) {
        hljs.highlightElement(block as HTMLElement);
      }
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={`saywa-markdown ${className ?? ''}`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
