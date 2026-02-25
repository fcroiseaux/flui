import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, 'packages');

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const FORBIDDEN_PATTERNS = [
  {
    name: 'new Function()',
    regex: /\bnew\s+Function\s*\(/,
  },
  {
    name: 'innerHTML assignment',
    regex: /\.innerHTML\s*=/,
  },
  {
    name: 'dynamic script injection',
    regex: /\bcreateElement\s*\(\s*['\"]script['\"]\s*\)|\binsertAdjacentHTML\s*\(/,
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'coverage') {
      continue;
    }

    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (FILE_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

async function main() {
  const files = await collectFiles(PACKAGES_DIR);
  const violations = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');

    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = pattern.regex.exec(content);
      if (match && match.index !== undefined) {
        const line = getLineNumber(content, match.index);
        violations.push({ filePath, line, rule: pattern.name });
      }
    }
  }

  if (violations.length > 0) {
    const details = violations
      .map((violation) => `${violation.filePath}:${violation.line} uses forbidden ${violation.rule}`)
      .join('\n');
    throw new Error(`Security check failed:\n${details}`);
  }
}

await main();
