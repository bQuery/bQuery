#!/usr/bin/env bun
/**
 * Verify that every place bQuery advertises module maturity agrees with the
 * canonical matrix in `scripts/stability-matrix.mjs` (#150):
 *
 * - `STABILITY.md`            — the human-facing source-of-truth table.
 * - `README.md`              — the "Modules at a glance" status table.
 * - `docs/introduction.md`   — the grouped "Stability matrix".
 *
 * Any drift (missing module, unexpected module, or wrong status) fails the run,
 * so the three surfaces can no longer silently diverge.
 *
 * Usage: bun scripts/check-stability-matrix.mjs
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { statusByModule } from './stability-matrix.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

const STATUS = '(Stable|Beta|Experimental)';

/** Extract the markdown section starting at a heading until the next heading. */
function sliceSection(markdown, headingMatcher) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => headingMatcher.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** Parse `STABILITY.md` — rows like `| \`router\` | Stable | … |`. */
function parseStabilityDoc(markdown) {
  const section = sliceSection(markdown, /^##\s+Matrix\b/);
  if (!section) throw new Error('STABILITY.md: could not find "## Matrix" section.');
  const re = new RegExp(`^\\|\\s*\`([a-z0-9]+)\`\\s*\\|\\s*${STATUS}\\s*\\|`, 'gm');
  return collect(re, section, (m) => [m[1], m[2]]);
}

/** Parse `README.md` — rows like `| **Router** | Stable | … |`. */
function parseReadme(markdown) {
  const section = sliceSection(markdown, /^##\s+Modules at a glance\b/);
  if (!section) throw new Error('README.md: could not find "## Modules at a glance" section.');
  const re = new RegExp(`^\\|\\s*\\*\\*([A-Za-z0-9]+)\\*\\*\\s*\\|\\s*${STATUS}\\s*\\|`, 'gm');
  return collect(re, section, (m) => [m[1].toLowerCase(), m[2]]);
}

/** Parse `docs/introduction.md` — grouped rows: `| **Stable** | \`a\`, \`b\` |`. */
function parseDocsMatrix(markdown) {
  const section = sliceSection(markdown, /^##\s+Stability matrix\b/);
  if (!section) throw new Error('docs/introduction.md: could not find "## Stability matrix" section.');
  const rowRe = new RegExp(`^\\|\\s*\\*\\*${STATUS}\\*\\*\\s*\\|([^|]*)\\|`, 'gm');
  const map = new Map();
  let match;
  while ((match = rowRe.exec(section)) !== null) {
    const status = match[1];
    for (const mod of match[2].matchAll(/`([a-z0-9]+)`/g)) {
      map.set(mod[1], status);
    }
  }
  if (map.size === 0) throw new Error('docs/introduction.md: parsed zero modules from the matrix.');
  return map;
}

function collect(re, text, pick) {
  const map = new Map();
  let match;
  while ((match = re.exec(text)) !== null) {
    const [mod, status] = pick(match);
    map.set(mod, status);
  }
  if (map.size === 0) throw new Error('Parsed zero modules — table format may have changed.');
  return map;
}

/** Compare a parsed source map against canonical; return discrepancy strings. */
export function diff(label, parsed, canonical) {
  const problems = [];
  for (const [mod, status] of canonical) {
    if (!parsed.has(mod)) {
      problems.push(`${label}: missing module \`${mod}\` (canonical: ${status})`);
    } else if (parsed.get(mod) !== status) {
      problems.push(`${label}: \`${mod}\` is "${parsed.get(mod)}" but canonical is "${status}"`);
    }
  }
  for (const mod of parsed.keys()) {
    if (!canonical.has(mod)) {
      problems.push(`${label}: unexpected module \`${mod}\` not in the canonical matrix`);
    }
  }
  return problems;
}

/**
 * Audit all three surfaces against the canonical matrix.
 * @returns {Promise<{ problems: string[], moduleCount: number }>}
 */
export async function auditStabilityMatrix({ root = repoRoot } = {}) {
  const canonical = statusByModule();
  const [stabilityDoc, readme, intro] = await Promise.all([
    readFile(resolve(root, 'STABILITY.md'), 'utf8'),
    readFile(resolve(root, 'README.md'), 'utf8'),
    readFile(resolve(root, 'docs', 'introduction.md'), 'utf8'),
  ]);

  const problems = [
    ...diff('STABILITY.md', parseStabilityDoc(stabilityDoc), canonical),
    ...diff('README.md', parseReadme(readme), canonical),
    ...diff('docs/introduction.md', parseDocsMatrix(intro), canonical),
  ];

  return { problems, moduleCount: canonical.size };
}

export async function main() {
  const { problems, moduleCount } = await auditStabilityMatrix();

  if (problems.length === 0) {
    console.log(
      `✓ Stability matrix is in sync across STABILITY.md, README.md, and docs/introduction.md (${moduleCount} modules).`
    );
    process.exit(0);
  }

  console.error('✗ Stability matrix drift detected:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nUpdate scripts/stability-matrix.mjs and reconcile the listed surface(s).');
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
