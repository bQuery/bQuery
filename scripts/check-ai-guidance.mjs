#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const readText = async (relativePath) => {
  const filePath = path.join(rootDir, relativePath);
  return readFile(filePath, 'utf8');
};

const packageJson = JSON.parse(await readText('package.json'));
const version = packageJson.version;
const nodeEngine = packageJson.engines?.node;
const bunEngine = packageJson.engines?.bun;

if (!version || !nodeEngine || !bunEngine) {
  console.error('package.json is missing required version or engines metadata.');
  process.exit(1);
}

const checks = [
  {
    filePath: 'AGENT.md',
    snippets: [
      `| Version     | ${version}`,
      `Node.js \`${nodeEngine}\`, Bun \`${bunEngine}\``,
      `## Version ${version} Highlights`,
      '`@bquery/bquery/server`',
      '`renderToStringAsync()`',
      '`bun run check:ai-guidance`',
    ],
  },
  {
    filePath: 'llms.txt',
    snippets: [
      `- Version: ${version}`,
      `- Supported engines: Node.js \`${nodeEngine}\`, Bun \`${bunEngine}\``,
      `## Version ${version} Highlights`,
      '`@bquery/bquery/server`',
      '`renderToStringAsync()`',
      '`bun run check:ai-guidance`',
    ],
  },
  {
    filePath: '.github/copilot-instructions.md',
    snippets: [
      `Current release baseline: **${version}**.`,
      `Node.js \`${nodeEngine}\`, Bun \`${bunEngine}\``,
      '`createServer()`',
      '`renderToStringAsync()`',
      '`bun run check:ai-guidance`',
    ],
  },
  {
    filePath: '.cursorrules',
    snippets: [
      `Current release baseline: **${version}**.`,
      `Bun \`${bunEngine}\``,
      '`createServer()`',
      '`renderToStringAsync()`',
      '`bun run check:ai-guidance`',
    ],
  },
  {
    filePath: '.clinerules',
    snippets: [
      `Current release baseline: **${version}**.`,
      `Bun \`${bunEngine}\``,
      '`createServer()`',
      '`renderToStringAsync()`',
      '`bun run check:ai-guidance`',
    ],
  },
  {
    filePath: 'README.md',
    snippets: ['## AI Agent Support', '`bun run check:ai-guidance`'],
  },
  {
    filePath: 'CONTRIBUTING.md',
    snippets: ['## AI guidance synchronization', '`bun run check:ai-guidance`'],
  },
];

const failures = [];

for (const check of checks) {
  const text = await readText(check.filePath);

  for (const snippet of check.snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${check.filePath} is missing expected snippet: ${snippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error('AI guidance drift detected:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `AI guidance is in sync with package.json (${version}, Node.js ${nodeEngine}, Bun ${bunEngine}).`
);
