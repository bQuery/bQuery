/**
 * Workflow branch-trigger guard (#211). Four workflows triggered on
 * `development`, a branch this repository never had, so their `pull_request`
 * jobs never ran for PRs into `dev`.
 *
 * The guard's own failure mode is a *silent* one: a `branches:` shape it does
 * not parse yields no refs, so re-introducing a bad branch name passes with
 * exit 0 — the exact regression it exists to catch. Most of these tests are
 * therefore about the shapes, not about the happy path.
 */

import { describe, expect, it } from 'bun:test';

const checkScriptUrl = new URL('../scripts/check-workflow-branches.mjs', import.meta.url).href;

interface BranchRef {
  name: string;
  key: string;
  line: number;
}

interface ParseProblem {
  line: number;
  reason: string;
}

interface CheckModule {
  extractBranchRefs: (source: string) => { refs: BranchRef[]; parseProblems: ParseProblem[] };
  upstreamRemote: (list?: string | null) => string;
  auditWorkflowBranches: () => Promise<{
    problems: string[];
    refCount: number;
    workflowCount: number;
    resolved: boolean;
  }>;
}

const { extractBranchRefs, upstreamRemote, auditWorkflowBranches } = (await import(
  checkScriptUrl
)) as unknown as CheckModule;

const names = (source: string): string[] => extractBranchRefs(source).refs.map((ref) => ref.name);

describe('extractBranchRefs', () => {
  it('reads block-sequence branch lists', () => {
    const { refs } = extractBranchRefs(
      ['on:', '  push:', '    branches:', '      - main', '      - dev'].join('\n')
    );
    expect(refs.map((ref) => ref.name)).toEqual(['main', 'dev']);
    expect(refs[0].key).toBe('branches');
    expect(refs[0].line).toBe(4);
  });

  it('reads a block sequence indented at the same column as its key', () => {
    // YAML allows a sequence item at its parent key's column, and workflows
    // commonly use it. Requiring a deeper indent yielded nothing at all, so
    // re-introducing `development` in this style passed with exit 0.
    expect(
      names(['on:', '  pull_request:', '    branches:', '    - main', '    - dev'].join('\n'))
    ).toEqual(['main', 'dev']);
  });

  it('reads inline branch lists and strips quotes', () => {
    expect(names('on:\n  pull_request:\n    branches: [\'main\', "dev"]')).toEqual(['main', 'dev']);
  });

  it('reads a flow sequence spread over several lines', () => {
    // `slice(1, lastIndexOf(']'))` on a lone `[` degrades to `slice(1, -1)`
    // and silently produced an empty list.
    expect(
      names(['on:', '  push:', '    branches: [', '      main,', '      dev,', '    ]'].join('\n'))
    ).toEqual(['main', 'dev']);
  });

  it('reads a bare scalar branch value', () => {
    expect(names('on:\n  push:\n    branches: dev')).toEqual(['dev']);
  });

  it('reports an unterminated flow sequence instead of skipping it', () => {
    const { refs, parseProblems } = extractBranchRefs('on:\n  push:\n    branches: [main,');
    expect(refs).toEqual([]);
    expect(parseProblems).toHaveLength(1);
    expect(parseProblems[0].reason).toContain('unterminated');
  });

  it('reports a branches key it cannot parse rather than passing silently', () => {
    const { refs, parseProblems } = extractBranchRefs(
      ['on:', '  push:', '    branches:', '    paths:', '      - docs/**'].join('\n')
    );
    expect(refs).toEqual([]);
    expect(parseProblems).toHaveLength(1);
  });

  it('reads branches-ignore and records the key', () => {
    const { refs } = extractBranchRefs('on:\n  push:\n    branches-ignore:\n      - gh-pages');
    expect(refs).toEqual([{ name: 'gh-pages', key: 'branches-ignore', line: 4 }]);
  });

  it('ignores a branches key outside the on: block', () => {
    // A `branches:` inside a `run: |` block, a heredoc, or an action's
    // `with:` input is not a trigger list. Several release and labeler
    // actions take a `branches` input.
    const source = [
      'on:',
      '  push:',
      '    branches:',
      '      - main',
      'jobs:',
      '  a:',
      '    steps:',
      '      - run: |',
      '          branches:',
      '            - nope',
      '      - uses: some/action@v1',
      '        with:',
      '          branches: also-not-a-trigger',
    ].join('\n');

    expect(names(source)).toEqual(['main']);
  });

  it('stops at the end of the list rather than consuming sibling keys', () => {
    expect(
      names(
        ['on:', '  push:', '    branches:', '      - main', '    paths:', '      - docs/**'].join(
          '\n'
        )
      )
    ).toEqual(['main']);
  });

  it('ignores comments and trailing comments', () => {
    expect(
      names(
        [
          'on:',
          '  push:',
          '    branches:',
          '      # the integration branch',
          '      - dev # not main',
        ].join('\n')
      )
    ).toEqual(['dev']);
  });
});

describe('upstreamRemote', () => {
  it('prefers a remote named upstream that points at the repository', () => {
    const list = [
      'origin\thttps://github.com/someone/bQuery.git (fetch)',
      'upstream\thttps://github.com/bQuery/bQuery.git (fetch)',
    ].join('\n');
    expect(upstreamRemote(list)).toBe('upstream');
  });

  it('uses origin when it is the upstream', () => {
    expect(upstreamRemote('origin\thttps://github.com/bQuery/bQuery.git (fetch)')).toBe('origin');
  });

  it('finds the upstream under any remote name', () => {
    const list = [
      'origin\thttps://github.com/someone/bQuery.git (fetch)',
      'canonical\tgit@github.com:bQuery/bQuery.git (fetch)',
    ].join('\n');
    expect(upstreamRemote(list)).toBe('canonical');
  });

  it('falls back to origin when no remote names the upstream', () => {
    // A fork-only clone: resolving against it would report every `dev`
    // trigger as missing, so `knownBranches` takes the skip path instead.
    expect(upstreamRemote('origin\thttps://github.com/someone/fork.git (fetch)')).toBe('origin');
    expect(upstreamRemote(null)).toBe('origin');
  });
});

describe('auditWorkflowBranches', () => {
  it('finds no unresolvable branch trigger in this repository', async () => {
    const { problems, refCount, workflowCount, resolved } = await auditWorkflowBranches();
    expect(workflowCount).toBeGreaterThan(0);
    if (!resolved) return; // no network and no local refs — nothing to assert against
    expect(refCount).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
