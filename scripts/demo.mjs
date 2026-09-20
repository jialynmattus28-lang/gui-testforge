import { spawn } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStudio } from '../apps/studio/server.mjs';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';
import { openBrowser } from './open-browser.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

export function assertSafeDemoWorkspace(root, workspace) {
  const expected = path.resolve(root, '.gui-testforge', 'demo');
  if (path.resolve(workspace) !== expected) {
    throw new Error(`Refusing to reset a path outside the isolated demo workspace: ${workspace}`);
  }
}

export function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false, windowsHide: true });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function ensureDependencies({ skipInstall }) {
  if (skipInstall) return;
  try {
    await access(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'package.json'));
  } catch {
    console.log('Preparing pinned npm dependencies...');
    await runCommand(executable('npm'), ['install', '--ignore-scripts']);
  }
  const { chromium } = await import('@playwright/test');
  try {
    await access(chromium.executablePath());
  } catch {
    console.log('Preparing the Playwright Chromium binary...');
    await runCommand(executable('npx'), ['playwright', 'install', 'chromium']);
  }
}

export async function runDemo({ noOpen = false, smoke = false, skipInstall = false } = {}) {
  await ensureDependencies({ skipInstall });
  const workspace = path.join(repoRoot, '.gui-testforge', 'demo');
  assertSafeDemoWorkspace(repoRoot, workspace);
  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });

  const [demoPort, studioPort] = await Promise.all([findFreePort(), findFreePort()]);
  const demoUrl = `http://127.0.0.1:${demoPort}`;
  const studioUrl = `http://127.0.0.1:${studioPort}`;
  let demo;
  const studio = await startStudio({
    port: studioPort,
    workspaceDirectory: workspace,
    demoAppUrl: demoUrl,
    beforeRun: async () => {
      if (!demo) demo = await startDemoApp({ port: demoPort });
    },
  });

  const shutdown = async () => {
    await Promise.all([studio.close(), demo?.close()]);
  };

  try {
    console.log('');
    console.log(`GUI TestForge: ${studioUrl}`);
    console.log(`Card Loss demo: starts at ${demoUrl} only when native tests run`);
    console.log('Press Ctrl+C to stop the local demo.');
    if (!noOpen && !smoke) openBrowser(studioUrl);
    if (smoke) {
      const status = await fetch(`${studioUrl}/api/status`).then((response) => response.json());
      if (status.requirements?.length !== 5) throw new Error('Smoke check did not load the bundled requirements');
      if (demo) throw new Error('Smoke check started the target GUI before the execution phase');
      await shutdown();
      return { studioUrl, demoUrl, targetStarted: false, smoke: 'passed' };
    }

    await new Promise((resolve) => {
      const finish = () => resolve();
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
    });
    await shutdown();
    return { studioUrl, demoUrl };
  } catch (error) {
    await shutdown();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = {
    noOpen: process.argv.includes('--no-open'),
    smoke: process.argv.includes('--smoke'),
    skipInstall: process.argv.includes('--skip-install'),
  };
  runDemo(options).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
