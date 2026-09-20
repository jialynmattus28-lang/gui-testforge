import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Demo setup failed with HTTP ${response.status}`);
  return response.json();
}

export async function createDriver(fixture, options = {}) {
  if (!options.baseUrl) throw new Error('GUI Driver requires options.baseUrl');
  await post(`${options.baseUrl}/api/test/reset`, fixture);
  const browser = await chromium.launch({ headless: options.headless !== false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(options.baseUrl, { waitUntil: 'networkidle' });

  async function readActualState() {
    const response = await page.request.get(`${options.baseUrl}/api/state`);
    if (!response.ok()) throw new Error(`Reading actual application state failed with HTTP ${response.status()}`);
    return response.json();
  }

  async function clickAndWait(testId, endpoint) {
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === endpoint
    ));
    await page.getByTestId(testId).click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`GUI action failed with HTTP ${response.status()}`);
    const state = await response.json();
    await page.waitForFunction(({ expectedScreen, expectedMessage }) => (
      document.body.dataset.screen === expectedScreen
      && document.querySelector('[data-testid="message-code"]')?.textContent === expectedMessage
    ), { expectedScreen: state.screen, expectedMessage: state.messageCode });
  }

  return {
    async act(action) {
      switch (action.name) {
        case 'readIdentity':
          await clickAndWait('read-identity', '/api/action/read-identity');
          break;
        case 'verifyFace':
          await clickAndWait('verify-face', '/api/action/verify-face');
          break;
        case 'selectCard': {
          const card = page.getByTestId(`card-${action.args.cardId}`);
          if (await card.isEnabled()) await clickAndWait(`card-${action.args.cardId}`, '/api/action/select-card');
          else await card.evaluate((element) => element.click());
          break;
        }
        case 'continue':
          await clickAndWait('continue', '/api/action/continue');
          break;
        case 'submitPassword':
          await page.getByTestId('password').fill(action.args.value);
          await clickAndWait('submit-password', '/api/action/submit-password');
          break;
        case 'exit':
          await post(`${options.baseUrl}/api/action/exit`, {});
          await page.reload({ waitUntil: 'networkidle' });
          break;
        default:
          throw new Error(`Unknown semantic action: ${action.name}`);
      }
    },

    async observe(query) {
      switch (query.target) {
        case 'screen':
          return page.locator('body').getAttribute('data-screen');
        case 'messageCode':
          return page.getByTestId('message-code').textContent();
        case 'selectedCardId': {
          const selected = page.locator('[data-testid^="card-"].selected');
          if ((await selected.count()) === 0) return null;
          return (await selected.first().getAttribute('data-testid')).replace('card-', '');
        }
        case 'canContinue':
          return (await page.locator('body').getAttribute('data-selected-card-id')) !== '';
        case 'businessOutcome':
          return page.locator('body').getAttribute('data-business-outcome');
        case 'card.status':
          return (await readActualState()).cards.find((card) => card.id === query.args.cardId)?.status ?? null;
        case 'card.selectable':
          return page.getByTestId(`card-${query.args.cardId}`).isEnabled();
        default:
          throw new Error(`Unknown semantic observation: ${query.target}`);
      }
    },

    async snapshot() {
      const snapshot = {
        url: page.url(),
        screen: await page.locator('body').getAttribute('data-screen'),
        title: await page.title(),
      };
      if (options.artifactDir) {
        await mkdir(options.artifactDir, { recursive: true });
        const screenshotPath = path.join(options.artifactDir, `${options.caseId ?? 'case'}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        snapshot.screenshot = screenshotPath;
      }
      return snapshot;
    },

    async close() {
      await browser.close();
    },
  };
}
