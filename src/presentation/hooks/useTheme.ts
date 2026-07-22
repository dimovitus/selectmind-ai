import { useEffect } from 'react';
import type { Settings } from '@/shared/types/settings';

export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const root = document.documentElement;

    const apply = (mode: 'dark' | 'light') => {
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }

    apply(theme);
  }, [theme]);
}
