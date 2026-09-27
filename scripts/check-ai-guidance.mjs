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

// SECURITY.md promises fixes for "the latest minor release line", so its
// table has to move with every minor release — it was left on 1.14.x while
// 1.17.0 shipped (#258).
const [major, minor] = version.split('.');
const supportedLine = `${major}.${minor}`;

const checks = [
  {
    filePath: 'SECURITY.md',
    snippets: [`| ${supportedLine}.x `, `| < ${supportedLine}.0 `],
  },
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

// Presence alone is not enough: a stale row left marked as supported (e.g.
// 1.17.x after 1.18.0 ships) would still satisfy the snippets above.
const securityText = await readText('SECURITY.md');
const supportedRows = securityText
  .split('\n')
  .filter((line) => line.trimStart().startsWith('|') && line.includes(':white_check_mark:'))
  .map((line) => line.split('|')[1].trim());
if (supportedRows.length !== 1 || supportedRows[0] !== `${supportedLine}.x`) {
  failures.push(
    `SECURITY.md must mark only ${supportedLine}.x as supported (found: ${supportedRows.join(', ') || 'none'})`
  );
}

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
