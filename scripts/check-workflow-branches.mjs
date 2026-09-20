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
      // Without this a hung network stalls `bun run check` indefinitely.
      timeout: 15_000,
    });
  } catch {
    return null;
  }
}

/** The upstream repository this check is about. */
const UPSTREAM = 'bQuery/bQuery';

/** A branch every clone of the upstream has; its absence means a fork. */
const SENTINEL_BRANCH = 'main';

/**
 * The remote that points at the upstream repository.
 *
 * `origin` is *not* it for anyone working from a fork, which is the normal
 * outside-contributor flow — and a fork routinely carries only its default
 * branch. Resolving against it reported every `branches: dev` trigger as
 * missing and failed `bun run check` on a clean tree.
 */
export function upstreamRemote(list = git(['remote', '-v'])) {
  if (!list) return 'origin';

  const matches = (name) =>
    list
      .split('\n')
      .some(
        (line) =>
          line.startsWith(`${name}\t`) && line.toLowerCase().includes(UPSTREAM.toLowerCase())
      );

  if (matches('upstream')) return 'upstream';
  if (matches('origin')) return 'origin';

  // Any remote whose URL names the upstream repository.
  for (const line of list.split('\n')) {
    if (!line.toLowerCase().includes(UPSTREAM.toLowerCase())) continue;
    const name = line.split('\t')[0];
    if (name) return name;
  }

  return 'origin';
}

/** Branch names this repository has, preferring the remote over local refs. */
export function knownBranches() {
  const remote = git(['ls-remote', '--heads', upstreamRemote()]);
  if (remote) {
    const names = remote
      .split('\n')
      .map((line) => line.split('refs/heads/')[1])
      .filter(Boolean);
    // A branch set without the repository's own default branch is not this
    // repository's — a fork, or a single-branch clone. Reporting every
    // trigger as missing would be a wall of false positives, so treat it as
    // "cannot resolve" and take the documented skip path instead.
    if (names.length > 0 && names.includes(SENTINEL_BRANCH)) return new Set(names);
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
  // Same sentinel as above. A shallow `actions/checkout` leaves essentially
  // one ref, so without this the offline path flags `main` as missing
  // instead of skipping with a note.
  return names.includes(SENTINEL_BRANCH) ? new Set(names) : null;
}

/** Strip a YAML scalar's quotes and trailing comment. */
function scalar(raw) {
  const value = raw.replace(/\s+#.*$/, '').trim();
  return value.replace(/^['"]|['"]$/g, '');
}

/**
 * Whether a line opens the top-level `on:` block.
 *
 * The scan used to match `branches:` anywhere in the file, so a `branches:`
 * inside a `run: |` literal block, a heredoc, or a third-party action's
 * `with:` input was parsed as a trigger list and reported as a nonexistent
 * branch. Several release and labeler actions take a `branches` input.
 */
const ON_KEY = /^(?:on|"on"|'on'):\s*(.*)$/;

/** A key at column 0 — the end of the `on:` block. */
const TOP_LEVEL_KEY = /^\S/;

/**
 * Collect literal branch names from a workflow's `branches:` blocks.
 *
 * Handles every shape GitHub accepts: an inline flow sequence, a flow
 * sequence spread over several lines, a block sequence (indented deeper than
 * its key *or* at the same column, which YAML allows and workflows commonly
 * use), and a bare scalar. Anything that looks like a list but cannot be
 * parsed is reported rather than skipped — a silent pass is exactly the
 * failure this guard exists to prevent.
 */
export function extractBranchRefs(source) {
  const refs = [];
  const parseProblems = [];
  const lines = source.split('\n');

  let inOnBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track the `on:` block so only real triggers are scanned.
    const onMatch = ON_KEY.exec(line);
    if (onMatch) {
      inOnBlock = true;
      // `on: push` or `on: [push, pull_request]` carries no branch filter.
      continue;
    }
    if (inOnBlock && TOP_LEVEL_KEY.test(line) && !line.startsWith('#')) {
      inOnBlock = false;
    }
    if (!inOnBlock) continue;

    const match = BRANCH_KEY.exec(line);
    if (!match) continue;
    const [, indent, key, rest] = match;

    const inline = rest.trim();

    if (inline.startsWith('[')) {
      // A flow sequence may span lines; `slice(1, lastIndexOf(']'))` on a
      // lone `[` degrades to `slice(1, -1)` and silently yields nothing.
      let body = inline;
      let end = i;
      while (!body.includes(']') && end + 1 < lines.length) {
        end++;
        body += ' ' + lines[end].trim();
      }
      if (!body.includes(']')) {
        parseProblems.push({
          line: i + 1,
          reason: `unterminated flow sequence after \`${key}:\``,
        });
        continue;
      }
      for (const entry of body.slice(1, body.lastIndexOf(']')).split(',')) {
        const name = scalar(entry);
        if (name) refs.push({ name, key, line: i + 1 });
      }
      i = end;
      continue;
    }

    if (inline && !inline.startsWith('#')) {
      // A bare scalar: `branches: dev`. Valid YAML, and GitHub accepts it.
      const name = scalar(inline);
      if (name) refs.push({ name, key, line: i + 1 });
      continue;
    }

    // Block sequence. A YAML sequence item may sit at or below its parent
    // key's column; requiring a deeper indent made the very common
    // same-column style yield nothing at all.
    let sawItem = false;
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j];
      if (!candidate.trim() || candidate.trim().startsWith('#')) continue;
      const item = /^(\s*)-\s+(.*)$/.exec(candidate);
      if (!item || item[1].length < indent.length) break;
      sawItem = true;
      const name = scalar(item[2]);
      if (name) refs.push({ name, key, line: j + 1 });
    }

    if (!sawItem) {
      parseProblems.push({
        line: i + 1,
        reason: `\`${key}:\` has no entries this parser recognizes`,
      });
    }
  }

  return { refs, parseProblems };
}

export async function auditWorkflowBranches() {
  const branches = knownBranches();
  const entries = (await readdir(workflowDir)).filter((file) => /\.ya?ml$/.test(file)).sort();

  const problems = [];
  let refCount = 0;

  for (const entry of entries) {
    const path = join(workflowDir, entry);
    const source = await readFile(path, 'utf8');
    const { refs, parseProblems } = extractBranchRefs(source);

    for (const problem of parseProblems) {
      problems.push(`${relative(repoRoot, path)}:${problem.line} — ${problem.reason}.`);
    }

    for (const ref of refs) {
      if (GLOB.test(ref.name)) continue;
      // `branches-ignore` carries the opposite meaning: a stale exclusion is
      // harmless by construction — the trigger still fires, it just excludes
      // nothing. Only `branches` has the silent-never-fires failure this
      // guard exists to catch, and holding the standard
      // `branches-ignore: [gh-pages]` to a must-exist rule fails a correct
      // workflow.
      if (ref.key === 'branches-ignore') continue;
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
