#!/usr/bin/env bun
/**
 * Verify that every branch named in a workflow trigger actually exists (#211).
 *
 * Four workflows kept triggering on `development`, a branch this repository
 * never had, so `pull_request` events targeting `dev` silently skipped ESLint,
 * the docs build and the link check. A stale branch name in an `on:` block has
 * no failure mode of its own — the workflow simply never runs — so it needs a
 * check of its own.
 *
 * Glob patterns (`**`, `release/*`, …) and negations are skipped; only literal
 * branch names are resolved. When no branch list can be obtained (no network
 * and no local refs) the check passes with a warning rather than failing.
 *
 * Usage: bun scripts/check-workflow-branches.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const workflowDir = join(repoRoot, '.github', 'workflows');

const BRANCH_KEY = /^(\s*)(branches|branches-ignore):(.*)$/;
const GLOB = /[*?[\]!+]/;

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/** Branch names this repository has, preferring the remote over local refs. */
export function knownBranches() {
  const remote = git(['ls-remote', '--heads', 'origin']);
  if (remote) {
    const names = remote
      .split('\n')
      .map((line) => line.split('refs/heads/')[1])
      .filter(Boolean);
    if (names.length > 0) return new Set(names);
  }

  const local = git([
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads',
    'refs/remotes/origin',
  ]);
  if (!local) return null;
  const names = local
    .split('\n')
    .map((line) => line.trim().replace(/^origin\//, ''))
    .filter((line) => line && line !== 'HEAD');
  return names.length > 0 ? new Set(names) : null;
}

/** Strip a YAML scalar's quotes and trailing comment. */
function scalar(raw) {
  const value = raw.replace(/\s+#.*$/, '').trim();
  return value.replace(/^['"]|['"]$/g, '');
}

/**
 * Collect literal branch names from a workflow's `branches:` blocks, in both
 * the inline (`branches: ['main', 'dev']`) and block-sequence forms.
 */
export function extractBranchRefs(source) {
  const refs = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = BRANCH_KEY.exec(lines[i]);
    if (!match) continue;
    const [, indent, key, rest] = match;

    const inline = rest.trim();
    if (inline.startsWith('[')) {
      const body = inline.slice(1, inline.lastIndexOf(']'));
      for (const entry of body.split(',')) {
        const name = scalar(entry);
        if (name) refs.push({ name, key, line: i + 1 });
      }
      continue;
    }
    if (inline && !inline.startsWith('#')) continue; // an anchor or alias — not a list

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const item = /^(\s*)-\s+(.*)$/.exec(line);
      if (!item || item[1].length <= indent.length) break;
      const name = scalar(item[2]);
      if (name) refs.push({ name, key, line: j + 1 });
    }
  }

  return refs;
}

export async function auditWorkflowBranches() {
  const branches = knownBranches();
  const entries = (await readdir(workflowDir)).filter((file) => /\.ya?ml$/.test(file)).sort();

  const problems = [];
  let refCount = 0;

  for (const entry of entries) {
    const path = join(workflowDir, entry);
    const source = await readFile(path, 'utf8');
    for (const ref of extractBranchRefs(source)) {
      if (GLOB.test(ref.name)) continue;
      refCount++;
      if (branches && !branches.has(ref.name)) {
        problems.push(
          `${relative(repoRoot, path)}:${ref.line} — \`${ref.key}: ${ref.name}\` has no remote branch.`
        );
      }
    }
  }

  return { problems, refCount, workflowCount: entries.length, resolved: branches !== null };
}

export async function main() {
  const { problems, refCount, workflowCount, resolved } = await auditWorkflowBranches();

  if (!resolved) {
    console.log(
      '• Workflow branch check skipped: no branch list available (no network and no local refs).'
    );
    process.exit(0);
  }

  if (problems.length === 0) {
    console.log(
      `✓ Workflow branch triggers all resolve (${refCount} refs across ${workflowCount} workflows).`
    );
    process.exit(0);
  }

  console.error('✗ Workflow triggers reference branches that do not exist:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nA trigger on a missing branch never fires — update the workflow or create the branch.'
  );
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
