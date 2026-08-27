import { PRODUCT_NAME } from './packages/shared/src/constants/brand';

/** Add-on ID for Firefox / Zen. Required for updates and AMO. */
export const FIREFOX_EXTENSION_ID = 'selectmind-ai@dimovitus';

export const FIREFOX_MIN_VERSION = '128.0';

export function createFirefoxManifest(version: string) {
  return {
    manifest_version: 3,
    name: PRODUCT_NAME,
    version,
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
      scripts: ['background.js'],
      type: 'module',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
    sidebar_action: {
      default_title: PRODUCT_NAME,
      default_panel: 'src/sidepanel/index.html',
      default_icon: {
        '16': 'assets/icons/icon-16.png',
        '32': 'assets/icons/icon-32.png',
      },
      open_at_install: false,
    },
    options_ui: {
      page: 'src/options/index.html',
      open_in_tab: true,
    },
    permissions: ['storage', 'activeTab', 'contextMenus', 'alarms'],
    host_permissions: ['<all_urls>'],
    commands: {
      'command-palette': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Open Command Palette',
      },
      '_execute_sidebar_action': {
        suggested_key: { default: 'Ctrl+Shift+E' },
        description: 'Toggle SelectMind AI sidebar',
      },
      'capture-screen': {
        suggested_key: { default: 'Ctrl+Shift+X' },
        description: 'Capture screen region for AI',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_EXTENSION_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
      },
    },
  };
}
