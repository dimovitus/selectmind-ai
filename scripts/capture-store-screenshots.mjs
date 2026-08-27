import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../dist');
const outDir = path.join(__dirname, '../docs/store-screenshots');

const STORE_VIEWPORT = { width: 1280, height: 800 };

mkdirSync(outDir, { recursive: true });

async function dismissOnboardingIfPresent(page) {
  for (let i = 0; i < 4; i++) {
    const next = page.getByRole('button', { name: /^Next$|^Continue$|^Get started$|^Finish$/i });
    const skip = page.getByRole('button', { name: /^Skip$/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
      continue;
    }
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
}

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: STORE_VIEWPORT,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const background =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = background.url().split('/')[2];
    if (!extensionId) throw new Error('Could not resolve extension ID');

    console.log(`Extension ID: ${extensionId}`);

    const options = await context.newPage();
    await options.setViewportSize(STORE_VIEWPORT);
    await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await options.getByRole('heading', { name: /SelectMind AI Settings/i }).waitFor();
    await dismissOnboardingIfPresent(options);
    await options.waitForTimeout(600);
    await options.screenshot({
      path: path.join(outDir, '01-settings-general.png'),
      fullPage: false,
    });
    console.log('Saved 01-settings-general.png');

    await options.getByRole('button', { name: /Providers/i }).click();
    await options.waitForTimeout(500);
    await options.screenshot({
      path: path.join(outDir, '02-settings-providers.png'),
      fullPage: false,
    });
    console.log('Saved 02-settings-providers.png');

    await options.getByRole('button', { name: /Actions/i }).click();
    await options.waitForTimeout(500);
    await options.screenshot({
      path: path.join(outDir, '03-settings-actions.png'),
      fullPage: false,
    });
    console.log('Saved 03-settings-actions.png');
    await options.close();

    const sidepanel = await context.newPage();
    await sidepanel.setViewportSize(STORE_VIEWPORT);
    await sidepanel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await sidepanel.getByRole('heading', { name: /SelectMind AI/i }).waitFor();
    await sidepanel.waitForTimeout(600);
    await sidepanel.screenshot({
      path: path.join(outDir, '04-side-panel.png'),
      fullPage: false,
    });
    console.log('Saved 04-side-panel.png');
    await sidepanel.close();

    const page = await context.newPage();
    await page.setViewportSize(STORE_VIEWPORT);
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    await page.waitForSelector('#saywa-root', { timeout: 20_000 });
    await page.evaluate(() => {
      const paragraph = document.querySelector('main p, p');
      if (!paragraph) return;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(outDir, '05-toolbar-on-page.png'),
      fullPage: false,
    });
    console.log('Saved 05-toolbar-on-page.png');

    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(outDir, '06-command-palette.png'),
      fullPage: false,
    });
    console.log('Saved 06-command-palette.png');
    await page.close();

    console.log(`\nStore screenshots saved to:\n${outDir}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
