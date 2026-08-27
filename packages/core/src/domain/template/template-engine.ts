import type { ContextBundle } from '../conversation/conversation.schema';
import {
  buildResponseLanguageInstruction,
  type ResponseLanguageCode,
} from '../../i18n/response-languages';

export interface TemplateVariable {
  name: string;
  description: string;
  resolver: (context: ContextBundle) => string | undefined;
}

export const BUILT_IN_VARIABLES: TemplateVariable[] = [
  {
    name: 'selection',
    description: 'Currently selected text',
    resolver: (ctx) => ctx.selection,
  },
  {
    name: 'page_title',
    description: 'Page title',
    resolver: (ctx) => ctx.pageTitle,
  },
  {
    name: 'url',
    description: 'Page URL',
    resolver: (ctx) => ctx.url,
  },
  {
    name: 'hostname',
    description: 'Page hostname',
    resolver: (ctx) => ctx.hostname,
  },
  {
    name: 'page_text',
    description: 'Extracted page text (truncated)',
    resolver: (ctx) => ctx.pageText,
  },
  {
    name: 'clipboard',
    description: 'Clipboard content',
    resolver: (ctx) => ctx.clipboard,
  },
  {
    name: 'language',
    description: 'Browser language',
    resolver: (ctx) => ctx.language,
  },
  {
    name: 'date',
    description: 'Current date',
    resolver: (ctx) => ctx.date,
  },
  {
    name: 'time',
    description: 'Current time',
    resolver: (ctx) => ctx.time,
  },
  {
    name: 'screenshot_ocr',
    description: 'OCR text extracted from a captured screenshot',
    resolver: (ctx) => ctx.screenshot?.ocrText,
  },
];

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function resolveTemplate(
  template: string,
  context: ContextBundle,
  extraVars: Record<string, string> = {},
): string {
  return template.replace(VARIABLE_PATTERN, (_match, varName: string) => {
    if (varName in extraVars) {
      return extraVars[varName] ?? '';
    }

    const variable = BUILT_IN_VARIABLES.find((v) => v.name === varName);
    if (variable) {
      return variable.resolver(context) ?? '';
    }

    return '';
  });
}

export function extractVariableNames(template: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');

  while ((match = pattern.exec(template)) !== null) {
    const name = match[1];
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}

export function buildContextSystemMessage(
  context: ContextBundle,
  responseLanguage: ResponseLanguageCode = 'auto',
): string {
  const lines: string[] = ['[Context]'];

  if (context.selection) {
    lines.push(`Selected text: "${context.selection}"`);
  }
  if (context.pageTitle) {
    lines.push(`Page: "${context.pageTitle}"`);
  }
  if (context.url) {
    lines.push(`URL: ${context.url}`);
  }
  if (context.customFragments.length > 0) {
    lines.push('Additional fragments:');
    context.customFragments.forEach((fragment, index) => {
      lines.push(`  ${index + 1}. [${fragment.label}]: "${fragment.content}"`);
    });
  }
  if (context.screenshot) {
    lines.push(
      `Screenshot captured (${context.screenshot.width}×${context.screenshot.height}px).`,
    );
    if (context.screenshot.ocrText?.trim()) {
      lines.push(`OCR text:\n${context.screenshot.ocrText.trim()}`);
    }
  }

  lines.push('', buildResponseLanguageInstruction(responseLanguage));

  return lines.join('\n');
}
