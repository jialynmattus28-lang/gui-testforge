import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../ir/index.mjs';
import { verifyFrozenAsset } from '../workflow/index.mjs';

const allowedEnvironmentKeys = new Set([
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SystemRoot',
  'WINDIR',
  'LOCALAPPDATA',
  'APPDATA',
  'PROGRAMDATA',
  'COMSPEC',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'CI',
  'PLAYWRIGHT_BROWSERS_PATH',
]);

function allowlistedEnvironment(source) {
  return Object.fromEntries(
    Object.entries(source ?? process.env).filter(([key, value]) => allowedEnvironmentKeys.has(key) && value !== undefined),
  );
}

function blocked(error) {
  return {
    testVerdict: 'NOT_EVALUATED',
    executionStatus: 'BLOCKED',
    error,
    cases: [],
    environmentKeys: [],
  };
}

export async function executeCompiledBundle({
  bundleDirectory,
  manifest,
  frozenAsset,
  driverPath,
  baseUrl,
  artifactDirectory,
  environment = process.env,
  onProgress = () => {},
  headless = true,
}) {
  if (!verifyFrozenAsset(frozenAsset) || frozenAsset.assetHash !== manifest.frozenAssetHash) {
    return blocked('Frozen asset hash verification failed before execution');
  }
  try {
    await access(driverPath);
  } catch {
    return blocked(`GUI Driver not found: ${path.basename(driverPath)}`);
  }

  const entryPath = path.join(bundleDirectory, manifest.entryFile);
  const source = await readFile(entryPath, 'utf8');
  if (sha256(source) !== manifest.files[manifest.entryFile]) {
    return blocked('Compiled bundle hash verification failed');
  }

  await mkdir(artifactDirectory, { recursive: true });
  const configurationPath = path.join(artifactDirectory, 'runner-config.json');
  const resultPath = path.join(artifactDirectory, 'result.json');
  await writeFile(configurationPath, JSON.stringify({
    entryPath,
    casesPath: manifest.casesFile ? path.join(bundleDirectory, manifest.casesFile) : null,
    driverPath: path.resolve(driverPath),
    baseUrl,
    artifactDirectory,
    resultPath,
    headless,
  }), 'utf8');

  const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [workerPath, configurationPath], {
      cwd: bundleDirectory,
      env: allowlistedEnvironment(environment),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop();
      for (const line of lines) {
        if (line.startsWith('PROGRESS ')) {
          try {
            onProgress(JSON.parse(line.slice('PROGRESS '.length)));
          } catch {
            // Malformed progress cannot affect the deterministic result.
          }
        }
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({
      testVerdict: 'NOT_EVALUATED',
      executionStatus: 'ERROR',
      error: error.message,
      cases: [],
      environmentKeys: [],
    }));
    child.on('close', async (code) => {
      try {
        const result = JSON.parse(await readFile(resultPath, 'utf8'));
        resolve(result);
      } catch (error) {
        resolve({
          testVerdict: 'NOT_EVALUATED',
          executionStatus: 'ERROR',
          error: stderr.trim() || `Runner worker exited with code ${code}: ${error.message}`,
          cases: [],
          environmentKeys: [],
        });
      }
    });
  });
}

export { allowlistedEnvironment };
