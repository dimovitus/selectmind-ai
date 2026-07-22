import { describe, it, expect } from 'vitest';
import {
  extractOpenAIDelta,
  extractAnthropicDelta,
  extractGeminiDelta,
} from '@/infrastructure/ai/streaming/sse-parser';

describe('extractOpenAIDelta', () => {
  it('extracts content from OpenAI SSE chunk', () => {
    const data = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
    expect(extractOpenAIDelta(data)).toBe('Hello');
  });

  it('returns null for [DONE]', () => {
    expect(extractOpenAIDelta('[DONE]')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(extractOpenAIDelta('not json')).toBeNull();
  });
});

describe('extractAnthropicDelta', () => {
  it('extracts text from content_block_delta event', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hi' },
    });
    expect(extractAnthropicDelta('content_block_delta', data)).toBe('Hi');
  });
});

describe('extractGeminiDelta', () => {
  it('extracts text from Gemini response', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Gemini says hi' }] } }],
    });
    expect(extractGeminiDelta(data)).toBe('Gemini says hi');
  });
});
