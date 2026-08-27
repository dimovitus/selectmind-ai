import { getCurrentWindow } from '@tauri-apps/api/window';
import type { PageContextPort, PageContextSnapshot } from '@selectmind/core';

function emptySnapshot(): PageContextSnapshot {
  const now = new Date();
  return {
    selection: '',
    pageTitle: typeof document !== 'undefined' ? document.title : '',
    url: '',
    hostname: '',
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
  };
}

/** Desktop: document title + optional Tauri window title. */
export class TauriPageContextAdapter implements PageContextPort {
  async extractCurrentContext(): Promise<PageContextSnapshot> {
    const base = emptySnapshot();

    try {
      const title = await getCurrentWindow().title();
      return { ...base, pageTitle: title || base.pageTitle || 'SelectMind AI' };
    } catch {
      return base;
    }
  }
}
