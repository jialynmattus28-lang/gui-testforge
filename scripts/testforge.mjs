#!/usr/bin/env node
import path from 'node:path';
import { checkPlaywrightProject, compilePlaywrightProject } from '../packages/integration-playwright/index.mjs';

function parseArguments(argv) {
  const [command, ...rest] = argv;
  let configPath = 'testforge.config.mjs';
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--config' && rest[index + 1]) {
      configPath = rest[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${rest[index]}`);
    }
  }
  if (!['compile', 'check'].includes(command)) {
    throw new Error('Usage: testforge <compile|check> [--config testforge.config.mjs]');
  }
  return { command, configPath: path.resolve(configPath) };
}

try {
  const { command, configPath } = parseArguments(process.argv.slice(2));
  const result = command === 'compile'
    ? await compilePlaywrightProject({ configPath })
    : await checkPlaywrightProject({ configPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
