import { describe, it, expect } from 'vitest';
import { resolveTemplate, extractVariableNames, buildContextSystemMessage } from '@/domain/template/template-engine';
import type { ContextBundle } from '@/domain/conversation/conversation.schema';

const sampleContext: ContextBundle = {
  selection: 'latency',
  pageTitle: 'Networking Guide',
  url: 'https://example.com/networking',
  hostname: 'example.com',
  language: 'en-US',
  date: '7/22/2026',
  time: '3:00 PM',
  customFragments: [],
};

describe('resolveTemplate', () => {
  it('replaces built-in variables', () => {
    const result = resolveTemplate(
      'Explain "{{selection}}" from page "{{page_title}}" at {{url}}',
      sampleContext,
    );
    expect(result).toBe(
      'Explain "latency" from page "Networking Guide" at https://example.com/networking',
    );
  });

  it('supports extra variables', () => {
    const result = resolveTemplate('Previous: {{prev_output}}', sampleContext, {
      prev_output: 'translated text',
    });
    expect(result).toBe('Previous: translated text');
  });

  it('replaces missing variables with empty string', () => {
    const result = resolveTemplate('Value: {{unknown_var}}', sampleContext);
    expect(result).toBe('Value: ');
  });
});

describe('extractVariableNames', () => {
  it('extracts unique variable names', () => {
    const names = extractVariableNames('{{selection}} and {{page_title}} and {{selection}}');
    expect(names).toEqual(['selection', 'page_title']);
  });
});

describe('buildContextSystemMessage', () => {
  it('builds context block for AI', () => {
    const message = buildContextSystemMessage(sampleContext);
    expect(message).toContain('[Context]');
    expect(message).toContain('Selected text: "latency"');
    expect(message).toContain('Page: "Networking Guide"');
    expect(message).toContain('URL: https://example.com/networking');
    expect(message).toContain('Respond in the same language');
  });

  it('adds fixed language instruction when configured', () => {
    const message = buildContextSystemMessage(sampleContext, 'uk');
    expect(message).toContain('Always respond in Ukrainian.');
  });
});
