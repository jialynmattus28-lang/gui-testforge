import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateDriverModule } from '../driver-contract/index.mjs';
import { sha256 } from '../ir/index.mjs';
import { verifyFrozenAsset } from '../workflow/index.mjs';
import { isPathSpecifier } from './config.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertModuleResolvable(moduleValue, label, config) {
  if (isPathSpecifier(moduleValue)) {
    if (!await exists(moduleValue)) throw new Error(`${label} not found: ${moduleValue}`);
    return;
  }
  try {
    createRequire(config.configPath).resolve(moduleValue);
  } catch {
    throw new Error(`${label} cannot be resolved: ${moduleValue}`);
  }
}

export async function checkCompiledPlaywrightProject(config) {
  const manifestPath = path.join(config.outputDirectory, 'manifest.json');
  if (!await exists(manifestPath)) throw new Error(`Compiled manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.compilerConfigHash !== sha256(config.compilerOptions)) {
    throw new Error('Compiler configuration does not match the generated manifest');
  }
  for (const [file, expectedHash] of Object.entries(manifest.files ?? {})) {
    const filePath = path.join(config.outputDirectory, file);
    if (!await exists(filePath)) throw new Error(`Generated file not found: ${filePath}`);
    const actualHash = sha256(await readFile(filePath, 'utf8'));
    if (actualHash !== expectedHash) throw new Error(`Generated file hash mismatch: ${file}`);
  }

  const asset = JSON.parse(await readFile(config.frozenAssetPath, 'utf8'));
  if (!verifyFrozenAsset(asset) || asset.assetHash !== manifest.frozenAssetHash) {
    throw new Error('Frozen asset hash verification failed');
  }
  await assertModuleResolvable(config.sourceModules.testModule, 'Test module', config);

  let driverStatus = 'NOT_IMPLEMENTED';
  if (isPathSpecifier(config.sourceModules.driverModule) && await exists(config.sourceModules.driverModule)) {
    await validateDriverModule(config.sourceModules.driverModule);
    driverStatus = 'READY';
  }

  return {
    framework: manifest.framework,
    integrity: 'VERIFIED',
    readyForDiscovery: true,
    readyForExecution: driverStatus === 'READY',
    executionStatus: 'NOT_EVALUATED',
    driverStatus,
    sourceHash: manifest.files[manifest.entryFile],
    manifest,
  };
}
