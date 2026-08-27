import { describe, expect, it } from 'vitest';

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /from\s+['"]chrome['"]/, reason: 'chrome API import' },
  { pattern: /import\s*\(\s*['"]chrome['"]\s*\)/, reason: 'dynamic chrome import' },
  { pattern: /from\s+['"]@\/(?!selectmind)/, reason: 'extension alias import' },
  { pattern: /from\s+['"]@selectmind\/shared['"]/, reason: 'shared package import (core must stay below shared)' },
];

const coreSources = import.meta.glob<string>('../../../packages/core/src/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('@selectmind/core platform isolation', () => {
  it('has no Chrome or extension-only imports', () => {
    const violations: string[] = [];

    for (const [filePath, source] of Object.entries(coreSources)) {
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${filePath}: ${reason}`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
