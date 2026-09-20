import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { startStudio } from '../apps/studio/server.mjs';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';
import { findFreePort } from '../scripts/demo.mjs';

let root;
let app;
let studio;
let browser;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-e2e-'));
  const demoPort = await findFreePort();
  const demoAppUrl = `http://127.0.0.1:${demoPort}`;
  studio = await startStudio({
    port: 0,
    workspaceDirectory: path.join(root, 'workspace'),
    demoAppUrl,
    beforeRun: async () => {
      if (!app) app = await startDemoApp({ port: demoPort });
    },
  });
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (studio) await studio.close();
  if (app) await app.close();
  if (root) await rm(root, { recursive: true, force: true });
});

test('end-to-end demo freezes, compiles, and executes seven cases through the real GUI', { timeout: 120000 }, async () => {
  const captureVideo = process.env.CAPTURE_VIDEO === '1';
  const videoContext = captureVideo ? await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: path.join(root, 'video'), size: { width: 1280, height: 720 } },
  }) : null;
  const page = videoContext
    ? await videoContext.newPage()
    : await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pause = () => captureVideo ? page.waitForTimeout(500) : Promise.resolve();
  await page.goto(studio.url, { waitUntil: 'networkidle' });
  await pause();

  await page.getByTestId('confirm-requirements').click();
  await page.getByRole('heading', { name: 'Create Test IR proposals' }).waitFor();
  await pause();
  await page.getByTestId('generate-ir').click();
  await page.getByRole('heading', { name: 'Review every Test IR case' }).waitFor();
  await pause();

  const caseItems = page.locator('.case-list-item');
  assert.equal(await caseItems.count(), 7);
  await page.getByTestId('approve-all').click();
  await page.getByRole('heading', { name: 'Freeze the reviewed test asset' }).waitFor();
  await pause();

  await page.getByTestId('freeze-asset').click();
  await page.getByRole('heading', { name: 'Compile into the existing Playwright project' }).waitFor();
  await pause();

  await page.getByTestId('compile-bundle').click();
  await page.getByRole('heading', { name: 'Run through the host Playwright framework' }).waitFor();
  await page.getByText('Waiting for application and GUI Driver', { exact: true }).waitFor();
  assert.equal(app, undefined);
  const sourceHashBeforeRun = await fetch(`${studio.url}/api/status`).then((response) => response.json()).then((status) => status.compilation.sourceHash);
  await pause();

  const run = page.getByTestId('run-tests');
  assert.equal(await run.isDisabled(), true);
  await page.getByTestId('use-bundled-demo').click();
  await page.getByText('READY FOR EXECUTION', { exact: true }).waitFor();
  assert.equal(app, undefined);
  assert.equal(await run.isEnabled(), true);
  await run.click();
  assert.ok(app);
  const summary = page.locator('.run-summary');
  await summary.waitFor({ timeout: 120000 });
  assert.match(await summary.textContent(), /PASS/);
  assert.match(await summary.textContent(), /7 passed \/ 0 failed \/ 0 not evaluated/);
  assert.equal(await page.locator('.result-row').count(), 7);
  const sourceHashAfterRun = await fetch(`${studio.url}/api/status`).then((response) => response.json()).then((status) => status.compilation.sourceHash);
  assert.equal(sourceHashAfterRun, sourceHashBeforeRun);
  const nativeReport = await fetch(`${studio.url}/playwright-report/index.html`);
  assert.equal(nativeReport.status, 200);
  assert.match(await nativeReport.text(), /Playwright Test Report/);
  await pause();
  if (process.env.CAPTURE_README === '1') {
    const assetDirectory = path.resolve('docs/assets');
    await mkdir(assetDirectory, { recursive: true });
    await page.screenshot({ path: path.join(assetDirectory, 'demo-workflow.png'), fullPage: true });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(studio.url, { waitUntil: 'networkidle' });
    await mobile.getByRole('button', { name: 'Run and Trace' }).click();
    await mobile.screenshot({ path: path.join(assetDirectory, 'demo-workflow-mobile.png'), fullPage: true });
    await mobile.close();
  }
  const video = page.video();
  await page.close();
  if (videoContext) {
    await videoContext.close();
    await mkdir(path.resolve('docs/assets'), { recursive: true });
    await video.saveAs(path.resolve('docs/assets/demo-workflow.webm'));
  }
});
