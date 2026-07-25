import type { PageContextPort, PageContextSnapshot } from '@selectmind/core';
import { extractPageContext } from '@/content/page-context-extractor';
import type { PageContext } from '@/shared/types/page-context';

function toSnapshot(context: PageContext): PageContextSnapshot {
  return context;
}

/** Chrome extension: DOM selection + page metadata from content script */
export class ChromePageContextAdapter implements PageContextPort {
  extractCurrentContext(): PageContextSnapshot {
    return toSnapshot(extractPageContext());
  }
}
