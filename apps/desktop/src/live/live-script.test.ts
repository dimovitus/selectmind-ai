import { describe, expect, it } from 'vitest';
import { textMatchesTargetScript } from './live-script';

describe('textMatchesTargetScript', () => {
  it('detects Russian already in target ru', () => {
    expect(textMatchesTargetScript('Ничего не переводит', 'ru')).toBe(true);
    expect(textMatchesTargetScript('Привет, мир!', 'ru')).toBe(true);
  });

  it('rejects Latin lookalike OCR garbage for ru', () => {
    expect(textMatchesTargetScript('HIYEro He NepeBoAuT', 'ru')).toBe(false);
    expect(textMatchesTargetScript('START', 'ru')).toBe(false);
  });

  it('detects English already in target en', () => {
    expect(textMatchesTargetScript('Nothing to translate here', 'en')).toBe(true);
    expect(textMatchesTargetScript('Ничего не переводит', 'en')).toBe(false);
  });
});
