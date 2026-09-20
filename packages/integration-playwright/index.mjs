import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { compileFrozenAsset } from '../compiler-playwright/index.mjs';
import { loadPlaywrightIntegrationConfig } from './config.mjs';
import { checkCompiledPlaywrightProject } from './check.mjs';

async function readFrozenAsset(config) {
  let source;
  try {
    source = await readFile(config.frozenAssetPath, 'utf8');
  } catch {
    throw new Error(`Frozen asset not found: ${config.frozenAssetPath}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Frozen asset is not valid JSON: ${error.message}`);
  }
}

export async function compilePlaywrightProject({ configPath }) {
  const config = await loadPlaywrightIntegrationConfig(configPath);
  const asset = await readFrozenAsset(config);
  const manifest = await compileFrozenAsset(asset, config.outputDirectory, config.compilerOptions);
  const entryPath = path.join(config.outputDirectory, manifest.entryFile);
  const driverStatus = config.sourceModules.driverModule.startsWith('/')
    ? await access(config.sourceModules.driverModule).then(() => 'READY', () => 'NOT_IMPLEMENTED')
    : 'NOT_IMPLEMENTED';
  return {
    ...manifest,
    manifest,
    entryPath,
    executionStatus: 'NOT_EVALUATED',
    driverStatus,
  };
}

export async function checkPlaywrightProject({ configPath }) {
  const config = await loadPlaywrightIntegrationConfig(configPath);
  return checkCompiledPlaywrightProject(config);
}

export { loadPlaywrightIntegrationConfig } from './config.mjs';
