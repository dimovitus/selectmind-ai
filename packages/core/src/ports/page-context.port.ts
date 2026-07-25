import type { PageContextSnapshot } from '../types/capture';

/** Reads context from the active surface (page, window, game). */
export interface PageContextPort {
  extractCurrentContext(): PageContextSnapshot | Promise<PageContextSnapshot>;
}
