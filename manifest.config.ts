import type { ManifestV3Export } from '@crxjs/vite-plugin';
import { PRODUCT_NAME } from './packages/shared/src/constants/brand';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: PRODUCT_NAME,
  version: '0.1.0',
  description: 'SelectMind AI — explain, translate, and chat about any text on the web',
  icons: {
    '16': 'assets/icons/icon-16.png',
    '32': 'assets/icons/icon-32.png',
    '48': 'assets/icons/icon-48.png',
    '128': 'assets/icons/icon-128.png',
  },
  action: {
    default_title: PRODUCT_NAME,
    default_icon: {
      '16': 'assets/icons/icon-16.png',
      '32': 'assets/icons/icon-32.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'activeTab', 'sidePanel', 'contextMenus', 'clipboardRead', 'alarms'],
  host_permissions: ['<all_urls>'],
  commands: {
    'command-palette': {
      suggested_key: { default: 'Ctrl+Shift+P' },
      description: 'Open Command Palette',
    },
    'toggle-sidepanel': {
      suggested_key: { default: 'Ctrl+Shift+S' },
      description: 'Toggle Side Panel',
    },
    'capture-screen': {
      suggested_key: { default: 'Ctrl+Shift+X' },
      description: 'Capture screen region for AI',
    },
  },
};

export default manifest;
