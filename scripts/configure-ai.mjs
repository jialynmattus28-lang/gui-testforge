import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));

function validate(configuration) {
  if (!configuration.baseUrl || !configuration.apiKey || !configuration.model) {
    throw new Error('Base URL, API key, and model are required');
  }
  const url = new URL(configuration.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must use HTTP or HTTPS');
}

export async function saveAiConfiguration(root, configuration) {
  validate(configuration);
  const directory = path.join(root, '.gui-testforge');
  const file = path.join(directory, 'ai-config.json');
  await mkdir(directory, { recursive: true });
  await writeFile(file, `${JSON.stringify({
    provider: 'openai-compatible',
    baseUrl: configuration.baseUrl.replace(/\/$/, ''),
    apiKey: configuration.apiKey,
    model: configuration.model,
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return file;
}

export async function loadAiConfiguration(root = defaultRoot, environment = process.env) {
  let local = {};
  try {
    local = JSON.parse(await readFile(path.join(root, '.gui-testforge', 'ai-config.json'), 'utf8'));
  } catch {
    // Live AI remains unconfigured when no local file exists.
  }
  const configuration = {
    provider: 'openai-compatible',
    baseUrl: environment.GUI_TESTFORGE_AI_BASE_URL ?? local.baseUrl,
    apiKey: environment.GUI_TESTFORGE_AI_API_KEY ?? local.apiKey,
    model: environment.GUI_TESTFORGE_AI_MODEL ?? local.model,
  };
  return {
    ...configuration,
    status: {
      provider: configuration.provider,
      configured: Boolean(configuration.baseUrl && configuration.apiKey && configuration.model),
      baseUrl: configuration.baseUrl ?? null,
      model: configuration.model ?? null,
    },
  };
}

async function main() {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('Configure an OpenAI-compatible provider. The API key stays in an ignored local file.');
    const baseUrl = await readline.question('Base URL: ');
    const model = await readline.question('Model: ');
    const apiKey = await readline.question('API key: ');
    const file = await saveAiConfiguration(defaultRoot, { baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
    console.log(`Configuration saved to ${path.relative(defaultRoot, file)}. The API key was not printed.`);
  } finally {
    readline.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
