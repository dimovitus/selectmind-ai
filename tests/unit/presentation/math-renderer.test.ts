import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { renderMath } from '@/presentation/components/markdown/render-math';

describe('renderMath', () => {
  it('renders \\(...\\) inline math', () => {
    const html = renderMath(String.raw`The identity \(a^2 + b^2 = c^2\) holds.`);

    expect(html).toContain('class="katex"');
    expect(html).not.toContain(String.raw`\(a^2`);
  });

  it('renders display math from the OCR-style \\[...\\] output', () => {
    const source = String.raw`\[
3\left(-\frac{27}{7}+5\right)
=3\left(\frac{8}{7}\right)
=\frac{24}{7}
\]`;

    const html = renderMath(source);
    expect(html).toContain('katex-display');
    expect(html).not.toContain(String.raw`\[`);

    const parsed = marked.parse(html) as string;
    expect(parsed).toContain('katex-display');
    expect(parsed).not.toContain('&#91;');
  });

  it('renders $$...$$ and $...$ math', () => {
    const html = renderMath(String.raw`Inline $x^2$ and display $$y = mx + b$$`);

    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('$x^2$');
    expect(html).not.toContain('$$y');
  });

  it('does not render math inside fenced code blocks or inline code', () => {
    const source = [
      '```js',
      'const price = "$5";',
      'const formula = String.raw`\\(x^2\\)`;',
      '```',
      'Use `$notMath$` in code, but $x^2$ outside.',
    ].join('\n');

    const html = renderMath(source);

    expect(html).toContain('const price = "$5";');
    expect(html).toContain('`$notMath$`');
    expect(html).toContain('class="katex"');
  });

  it('keeps an invalid expression readable instead of throwing', () => {
    const html = renderMath(String.raw`\[
\frac{1}{
\]`);

    expect(html).toContain('katex');
  });
});
