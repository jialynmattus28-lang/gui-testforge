import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ignoredDirectories = new Set(['.git', 'node_modules', '.gui-testforge', 'test-results', 'playwright-report']);
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.txt', '.example']);

async function walk(directory, root, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, root, files);
    else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return files;
}

function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

export async function auditRepository(root) {
  const findings = [];
  const files = await walk(root, root);
  for (const file of files) {
    if (file === '.env' || file.startsWith('.data/') || file.includes('/.data/')) {
      findings.push(`${file}: forbidden tracked runtime file`);
      continue;
    }
    const extension = path.extname(file);
    if (!textExtensions.has(extension) && !['LICENSE', '.gitignore'].includes(path.basename(file))) continue;
    const content = await readFile(path.join(root, file), 'utf8');
    const checks = [
      { pattern: /\/Users\/(?!\.\.\.\/)[A-Za-z0-9._-]+\//g, message: 'developer-specific macOS path' },
      { pattern: /[A-Za-z]:\\Users\\(?!\.\.\.\\)[A-Za-z0-9._-]+\\/g, message: 'developer-specific Windows path' },
      { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, message: 'possible API key' },
      { pattern: /\b[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|126|163)\.com\b/gi, message: 'personal email address' },
    ];
    for (const check of checks) {
      for (const match of content.matchAll(check.pattern)) {
        findings.push(`${file}:${lineNumber(content, match.index)}: ${check.message}`);
      }
    }
    if ((file.startsWith('apps/studio/public/') || file.startsWith('examples/card-loss/demo-app/public/')) && /[\u3400-\u9fff]/u.test(content)) {
      findings.push(`${file}: non-English user-facing UI text`);
    }
    if ((file.startsWith('packages/compiler-playwright/') || file.startsWith('packages/runner-playwright/')) && /(?:from|import\()\s*['"][^'"]*ai-(?:provider|replay|openai)/i.test(content)) {
      findings.push(`${file}: deterministic execution imports an AI module`);
    }
  }
  return findings.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = await auditRepository(process.cwd());
  if (findings.length > 0) {
    console.error(`Public release audit failed with ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log('Public release audit passed: no secrets, private paths, runtime data, Chinese UI text, or AI execution imports found.');
  }
}
