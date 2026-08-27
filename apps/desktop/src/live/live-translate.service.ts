import { invoke } from '@tauri-apps/api/core';
import { parseNumberedTranslationResponse } from './live-translate-parse';
import type { ProviderId } from '@/domain/shared/ids';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { getDesktopContainer } from '../di/container';
import { reloadProviderRegistry } from '../storage/seed';
import { engineRequiresNetwork } from './engine-label';
import type { LiveTranslationEngine } from './live-settings';
import type { OcrLineBox } from './types';
import { getCachedTranslation, setCachedTranslation } from './translation-cache';
import { textMatchesTargetScript } from './live-script';

const requestTimestamps: number[] = [];

interface TranslateBatchResult {
  translations: string[];
  engineUsed: string;
}

export interface TranslateOcrLinesResult {
  translations: Map<string, string>;
  engineUsed: string | null;
  rateLimited: boolean;
}

function canMakeRequest(maxPerMinute: number): boolean {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0]! > 60_000) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length < maxPerMinute;
}

function markRequest(): void {
  requestTimestamps.push(Date.now());
}

async function translateBatchViaRust(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
  engine: LiveTranslationEngine,
  lingvaBaseUrl: string,
  localLibreTranslateUrl: string,
  autoFallback: boolean,
): Promise<TranslateBatchResult> {
  return invoke<TranslateBatchResult>('translate_batch', {
    args: {
      texts,
      targetLanguage,
      sourceLanguage,
      engine,
      lingvaBaseUrl,
      localLibretranslateUrl: localLibreTranslateUrl,
      autoFallback,
    },
  });
}

async function translateBatchViaProvider(
  texts: string[],
  targetLanguage: string,
  providerId: ProviderId,
  model: string | null,
): Promise<string[]> {
  const container = getDesktopContainer();
  await reloadProviderRegistry(container);
  const { provider, model: resolvedModel } = container.aiRouter.resolve(providerId, model ?? undefined);

  const numbered = texts.map((text, index) => `${index + 1}. ${text}`).join('\n');
  const systemPrompt =
    'You translate game UI and dialogue lines. Reply with the same numbering only. No commentary.';
  const userPrompt = `Translate each numbered line to ${targetLanguage}. Keep names and proper nouns when appropriate.\n\n${numbered}`;

  const response = await provider.complete({
    model: resolvedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  const parsed = parseNumberedTranslationResponse(response, texts.length);
  if (parsed) return parsed;

  const fallback: string[] = [];
  for (const text of texts) {
    const single = await provider.complete({
      model: resolvedModel,
      messages: [
        {
          role: 'user',
          content: `Translate to ${targetLanguage}. Reply with translation only:\n${text}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 256,
    });
    fallback.push(single.trim());
  }
  return fallback;
}

export async function translateOcrLines(
  lines: OcrLineBox[],
  targetLanguage: string,
  sourceLanguage: string,
  maxRequestsPerMinute: number,
  translationEngine: LiveTranslationEngine,
  lingvaBaseUrl: string,
  localLibreTranslateUrl: string,
  autoFallback: boolean,
): Promise<TranslateOcrLinesResult> {
  const result = new Map<string, string>();
  if (lines.length === 0) {
    return { translations: result, engineUsed: null, rateLimited: false };
  }

  const pending: string[] = [];
  for (const line of lines) {
    const source = line.text.trim();
    if (!source) continue;

    // Already in the target script (e.g. Russian UI + target=ru) — sending it
    // through Google with sl=en produces mixed-script garbage.
    if (textMatchesTargetScript(source, targetLanguage)) {
      result.set(source, source);
      continue;
    }

    const cached = getCachedTranslation(source, targetLanguage);
    if (cached) {
      result.set(source, cached);
      continue;
    }

    if (!result.has(source) && !pending.includes(source)) {
      pending.push(source);
    }
  }

  if (pending.length === 0) {
    return { translations: result, engineUsed: null, rateLimited: false };
  }

  if (engineRequiresNetwork(translationEngine) && !canMakeRequest(maxRequestsPerMinute)) {
    return { translations: result, engineUsed: null, rateLimited: true };
  }

  if (engineRequiresNetwork(translationEngine)) {
    markRequest();
  }

  let translations: string[] = [];
  let engineUsed: string | null = null;

  if (translationEngine === 'ai-provider') {
    const settings = await rpcClient.call('settings:get', undefined);
    const providerId = settings.defaultProviderId;
    if (!providerId) {
      throw new Error(
        'Configure a default AI provider in Settings, or switch engine to Google/Bing (free).',
      );
    }
    translations = await translateBatchViaProvider(
      pending,
      targetLanguage,
      providerId,
      settings.defaultModel,
    );
    engineUsed = 'ai-provider';
  } else {
    const batch = await translateBatchViaRust(
      pending,
      targetLanguage,
      sourceLanguage,
      translationEngine,
      lingvaBaseUrl,
      localLibreTranslateUrl,
      autoFallback,
    );
    translations = batch.translations;
    engineUsed = batch.engineUsed;
  }

  pending.forEach((source, index) => {
    const translated = translations[index]?.trim();
    if (!translated) return;
    setCachedTranslation(source, targetLanguage, translated);
    result.set(source, translated);
  });

  return { translations: result, engineUsed, rateLimited: false };
}
