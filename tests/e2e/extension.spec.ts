import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const background = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker');
  extensionId = background.url().split('/')[2] ?? '';
  expect(extensionId).toBeTruthy();
});

test.afterAll(async () => {
  await context.close();
});

test('options page loads', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await expect(page.getByRole('heading', { name: /SelectMind AI Settings/i })).toBeVisible();
  await page.close();
});

test('side panel page loads', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
  await expect(page.getByRole('heading', { name: /SelectMind AI/i })).toBeVisible();
  await page.close();
});

test('content script injects on a page', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForSelector('#saywa-app', { timeout: 15_000 });
  await page.close();
});
