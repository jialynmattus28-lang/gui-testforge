import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startStudio } from '../apps/studio/server.mjs';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';
import { findFreePort } from './demo.mjs';

export const PRE_CLICK_PAUSE_MS = 2_000;
export const POST_RESULT_PAUSE_MS = 2_300;

export const CAPTIONS = {
  en: {
    requirements: 'Confirm the reviewed requirements',
    generate: 'Generate Test IR proposals',
    approve: 'Approve every Test IR case',
    freeze: 'Freeze the human-reviewed Test IR asset',
    compile: 'Compile native Playwright tests with a non-AI compiler',
    connect: 'Connect the target application and GUI Driver',
    run: 'Run the unchanged scripts with Playwright',
    results: 'Review deterministic test results',
  },
  'zh-CN': {
    requirements: '确认已经评审的测试需求',
    generate: '生成 Test IR 提案',
    approve: '审批全部 Test IR',
    freeze: '冻结人工审核后的 Test IR 资产',
    compile: '使用非 AI 编译器生成原生 Playwright 脚本',
    connect: '接入被测程序和 GUI Driver',
    run: '使用 Playwright 执行未修改的测试脚本',
    results: '查看确定性的测试结果',
  },
};

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDirectory = path.join(rootDirectory, 'docs', 'assets');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function installPresentationOverlay(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.dataset.readmeDemo = 'true';
    style.textContent = `
      #readme-demo-pointer {
        position: fixed;
        left: 50%;
        top: 50%;
        width: 34px;
        height: 34px;
        border: 4px solid #e94f37;
        border-radius: 50%;
        box-sizing: border-box;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.92), 0 3px 14px rgba(0, 0, 0, 0.35);
        transform: translate(-50%, -50%);
        transition: left 700ms ease, top 700ms ease, transform 160ms ease;
        pointer-events: none;
        z-index: 2147483647;
      }
      #readme-demo-caption {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 22px;
        width: min(840px, calc(100vw - 80px));
        min-height: 58px;
        padding: 14px 22px;
        border-left: 6px solid #18a17f;
        border-radius: 6px;
        background: rgba(20, 31, 38, 0.94);
        color: #fff;
        font: 600 22px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        box-sizing: border-box;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        pointer-events: none;
        z-index: 2147483646;
      }
      .readme-demo-pulse {
        position: fixed;
        width: 36px;
        height: 36px;
        border: 5px solid #e94f37;
        border-radius: 50%;
        box-sizing: border-box;
        pointer-events: none;
        z-index: 2147483645;
      }
    `;
    document.head.append(style);

    const pointer = document.createElement('div');
    pointer.id = 'readme-demo-pointer';
    document.body.append(pointer);

    const caption = document.createElement('div');
    caption.id = 'readme-demo-caption';
    caption.setAttribute('role', 'presentation');
    document.body.append(caption);
  });
}

async function setCaption(page, text) {
  await page.locator('#readme-demo-caption').evaluate((element, caption) => {
    element.textContent = caption;
  }, text);
}

async function movePointerTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, 'Demo target must have a visible bounding box');
  const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await page.locator('#readme-demo-pointer').evaluate((element, nextPoint) => {
    element.style.left = `${nextPoint.x}px`;
    element.style.top = `${nextPoint.y}px`;
  }, point);
  await page.waitForTimeout(850);
  return point;
}

async function showClickPulse(page, point) {
  await page.evaluate(({ x, y }) => {
    const pulse = document.createElement('div');
    pulse.className = 'readme-demo-pulse';
    pulse.style.left = `${x - 18}px`;
    pulse.style.top = `${y - 18}px`;
    document.body.append(pulse);
    pulse.animate(
      [
        { opacity: 1, transform: 'scale(0.55)' },
        { opacity: 0, transform: 'scale(2.15)' },
      ],
      { duration: 650, easing: 'ease-out' },
    ).finished.finally(() => pulse.remove());
  }, point);
  await page.locator('#readme-demo-pointer').evaluate((element) => {
    element.style.transform = 'translate(-50%, -50%) scale(0.72)';
    setTimeout(() => {
      element.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 180);
  });
  await page.waitForTimeout(240);
}

async function clickStep(page, { locator, caption, waitFor }) {
  await setCaption(page, caption);
  const point = await movePointerTo(page, locator);
  await page.waitForTimeout(PRE_CLICK_PAUSE_MS);
  await showClickPulse(page, point);
  await locator.click();
  await waitFor();
  await page.waitForTimeout(POST_RESULT_PAUSE_MS);
}

async function createGif(webmPath, gifPath) {
  const filter = [
    'fps=10',
    'scale=960:-1:flags=lanczos',
    'split[s0][s1]',
    '[s0]palettegen=max_colors=128[p]',
    '[s1][p]paletteuse=dither=bayer:bayer_scale=3',
  ].join(',');
  await run('ffmpeg', ['-y', '-i', webmPath, '-vf', filter, gifPath]);
}

export async function captureLocale(locale) {
  const captions = CAPTIONS[locale];
  if (!captions) throw new Error(`Unsupported locale: ${locale}`);

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), `gui-testforge-readme-${locale}-`));
  const demoPort = await findFreePort();
  const demoAppUrl = `http://127.0.0.1:${demoPort}`;
  let app;
  let studio;
  let browser;

  try {
    studio = await startStudio({
      port: 0,
      workspaceDirectory: path.join(temporaryRoot, 'workspace'),
      demoAppUrl,
      beforeRun: async () => {
        if (!app) app = await startDemoApp({ port: demoPort });
      },
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: path.join(temporaryRoot, 'video'), size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto(studio.url, { waitUntil: 'networkidle' });
    await installPresentationOverlay(page);
    await page.waitForTimeout(POST_RESULT_PAUSE_MS);

    await clickStep(page, {
      locator: page.getByTestId('confirm-requirements'),
      caption: captions.requirements,
      waitFor: () => page.getByRole('heading', { name: 'Create Test IR proposals' }).waitFor(),
    });
    await clickStep(page, {
      locator: page.getByTestId('generate-ir'),
      caption: captions.generate,
      waitFor: () => page.getByRole('heading', { name: 'Review every Test IR case' }).waitFor(),
    });

    const caseItems = page.locator('.case-list-item');
    assert.equal(await caseItems.count(), 7);
    await clickStep(page, {
      locator: page.getByTestId('approve-all'),
      caption: captions.approve,
      waitFor: () => page.getByRole('heading', { name: 'Freeze the reviewed test asset' }).waitFor(),
    });
    await clickStep(page, {
      locator: page.getByTestId('freeze-asset'),
      caption: captions.freeze,
      waitFor: () => page.getByRole('heading', { name: 'Compile into the existing Playwright project' }).waitFor(),
    });
    await clickStep(page, {
      locator: page.getByTestId('compile-bundle'),
      caption: captions.compile,
      waitFor: async () => {
        await page.getByRole('heading', { name: 'Run through the host Playwright framework' }).waitFor();
        await page.getByText('Waiting for application and GUI Driver', { exact: true }).waitFor();
      },
    });

    const runButton = page.getByTestId('run-tests');
    assert.equal(await runButton.isDisabled(), true);
    await clickStep(page, {
      locator: page.getByTestId('use-bundled-demo'),
      caption: captions.connect,
      waitFor: async () => {
        await page.getByText('READY FOR EXECUTION', { exact: true }).waitFor();
        assert.equal(await runButton.isEnabled(), true);
      },
    });
    await clickStep(page, {
      locator: runButton,
      caption: captions.run,
      waitFor: async () => {
        const summary = page.locator('.run-summary');
        await summary.waitFor({ timeout: 120_000 });
        assert.match(await summary.textContent(), /7 passed \/ 0 failed \/ 0 not evaluated/);
      },
    });
    await setCaption(page, captions.results);
    await page.waitForTimeout(3_500);

    const video = page.video();
    await page.close();
    await context.close();
    await mkdir(assetDirectory, { recursive: true });
    const webmPath = path.join(assetDirectory, `demo-workflow-${locale}.webm`);
    const gifPath = path.join(assetDirectory, `demo-workflow-${locale}.gif`);
    await video.saveAs(webmPath);
    await createGif(webmPath, gifPath);
    return { gifPath, webmPath };
  } finally {
    if (browser) await browser.close();
    if (studio) await studio.close();
    if (app) await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function parseLocales(argv) {
  const localeArgument = argv.find((argument) => argument.startsWith('--locale='));
  if (!localeArgument) return ['en', 'zh-CN'];
  const locale = localeArgument.slice('--locale='.length);
  if (!CAPTIONS[locale]) throw new Error(`Unsupported locale: ${locale}`);
  return [locale];
}

async function main() {
  for (const locale of parseLocales(process.argv.slice(2))) {
    const outputs = await captureLocale(locale);
    console.log(`${locale}: ${path.relative(rootDirectory, outputs.gifPath)}`);
    console.log(`${locale}: ${path.relative(rootDirectory, outputs.webmPath)}`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
