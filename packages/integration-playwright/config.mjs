import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function isPathSpecifier(value) {
  return value.startsWith('.') || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value);
}

function toImportSpecifier(fromDirectory, value, configDirectory) {
  if (!isPathSpecifier(value)) return value;
  const target = path.resolve(configDirectory, value);
  const relative = path.relative(fromDirectory, target).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function requireString(config, field) {
  if (typeof config[field] !== 'string' || config[field].trim() === '') {
    throw new Error(`Playwright integration config requires ${field}`);
  }
  return config[field];
}

export async function loadPlaywrightIntegrationConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  try {
    await access(absoluteConfigPath);
  } catch {
    throw new Error(`Integration config not found: ${absoluteConfigPath}`);
  }
  const imported = await import(`${pathToFileURL(absoluteConfigPath).href}?loaded=${Date.now()}`);
  const raw = imported.default;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Playwright integration config must export a default object');
  }

  const configDirectory = path.dirname(absoluteConfigPath);
  const outputDirectory = path.resolve(configDirectory, requireString(raw, 'outputDir'));
  const testModule = requireString(raw, 'testModule');
  const driverModule = requireString(raw, 'driverModule');
  return {
    configPath: absoluteConfigPath,
    configDirectory,
    workingDirectory: path.resolve(configDirectory, raw.workingDirectory ?? '.'),
    frozenAssetPath: path.resolve(configDirectory, requireString(raw, 'frozenAsset')),
    outputDirectory,
    playwrightConfigPath: raw.playwrightConfig ? path.resolve(configDirectory, raw.playwrightConfig) : null,
    sourceModules: {
      testModule: isPathSpecifier(testModule) ? path.resolve(configDirectory, testModule) : testModule,
      driverModule: isPathSpecifier(driverModule) ? path.resolve(configDirectory, driverModule) : driverModule,
    },
    compilerOptions: {
      testModule: toImportSpecifier(outputDirectory, testModule, configDirectory),
      driverModule: toImportSpecifier(outputDirectory, driverModule, configDirectory),
      fileExtension: raw.fileExtension ?? '.spec.mjs',
      fixtureNames: raw.fixtureNames ?? ['page'],
    },
  };
}

export { isPathSpecifier };
