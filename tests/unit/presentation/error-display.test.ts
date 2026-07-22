import { describe, it, expect } from 'vitest';

// Mirror error parsing logic for unit testing
function parseErrorTitle(error: string): string {
  if (error.toLowerCase().includes('no ai provider configured')) return 'No Provider Configured';
  if (error.includes('401') || error.includes('Unauthorized')) return 'Authentication Failed';
  if (error.includes('429')) return 'Rate Limit';
  return 'Something went wrong';
}

describe('error display hints', () => {
  it('detects missing provider', () => {
    expect(parseErrorTitle('No AI provider configured')).toBe('No Provider Configured');
  });

  it('detects auth errors', () => {
    expect(parseErrorTitle('HTTP 401 Unauthorized')).toBe('Authentication Failed');
  });

  it('detects rate limits', () => {
    expect(parseErrorTitle('Error 429: Too Many Requests')).toBe('Rate Limit');
  });
});
