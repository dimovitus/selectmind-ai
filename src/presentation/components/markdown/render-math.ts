import katex from 'katex';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    });
  } catch {
    return `<span class="math-error">${escapeHtml(tex)}</span>`;
  }
}

/**
 * Convert LaTeX delimiters used by chat models into KaTeX HTML:
 *   \(...\)  inline      \[...\]  display
 *   $...$    inline      $$...$$  display
 *
 * Fenced code blocks and inline code are protected so `$` inside code is not
 * interpreted as math.
 */
export function renderMath(text: string): string {
  const protectedCode: string[] = [];
  const renderedMath: string[] = [];

  const stashCode = (match: string): string => {
    const token = `\u0000GLOSS_CODE_${protectedCode.length}\u0000`;
    protectedCode.push(match);
    return token;
  };

  const stashMath = (html: string): string => {
    const token = `\u0000GLOSS_MATH_${renderedMath.length}\u0000`;
    renderedMath.push(html);
    return token;
  };

  let result = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, stashCode);

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex: string) =>
    stashMath(renderTex(tex, true)),
  );
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_match, tex: string) =>
    stashMath(renderTex(tex, true)),
  );
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_match, tex: string) =>
    stashMath(renderTex(tex, false)),
  );
  result = result.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_match, tex: string) =>
    stashMath(renderTex(tex, false)),
  );

  result = result.replace(/\u0000GLOSS_CODE_(\d+)\u0000/g, (_match, index: string) => {
    return protectedCode[Number(index)] ?? '';
  });
  result = result.replace(/\u0000GLOSS_MATH_(\d+)\u0000/g, (_match, index: string) => {
    return renderedMath[Number(index)] ?? '';
  });

  return result;
}
