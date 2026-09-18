/**
 * Workflow branch-trigger guard (#211). Four workflows triggered on
 * `development`, a branch this repository never had, so their `pull_request`
 * jobs never ran for PRs into `dev`.
 */

import { describe, expect, it } from 'bun:test';

const checkScriptUrl = new URL('../scripts/check-workflow-branches.mjs', import.meta.url).href;

interface BranchRef {
  name: string;
  key: string;
  line: number;
}

interface CheckModule {
  extractBranchRefs: (source: string) => BranchRef[];
  auditWorkflowBranches: () => Promise<{
    problems: string[];
    refCount: number;
    workflowCount: number;
    resolved: boolean;
  }>;
}

const { extractBranchRefs, auditWorkflowBranches } = (await import(
  checkScriptUrl
)) as unknown as CheckModule;

describe('extractBranchRefs', () => {
  it('reads block-sequence branch lists', () => {
    const refs = extractBranchRefs(
      ['on:', '  push:', '    branches:', '      - main', '      - dev'].join('\n')
    );
    expect(refs.map((ref) => ref.name)).toEqual(['main', 'dev']);
    expect(refs[0].key).toBe('branches');
    expect(refs[0].line).toBe(4);
  });

  it('reads inline branch lists and strips quotes', () => {
    const refs = extractBranchRefs('on:\n  pull_request:\n    branches: [\'main\', "dev"]');
    expect(refs.map((ref) => ref.name)).toEqual(['main', 'dev']);
  });

  it('reads branches-ignore and records the key', () => {
    const refs = extractBranchRefs('on:\n  push:\n    branches-ignore:\n      - gh-pages');
    expect(refs).toEqual([{ name: 'gh-pages', key: 'branches-ignore', line: 4 }]);
  });

  it('stops at the end of the list rather than consuming sibling keys', () => {
    const refs = extractBranchRefs(
      ['on:', '  push:', '    branches:', '      - main', '    paths:', '      - docs/**'].join(
        '\n'
      )
    );
    expect(refs.map((ref) => ref.name)).toEqual(['main']);
  });

  it('ignores comments and trailing comments', () => {
    const refs = extractBranchRefs(
      [
        'on:',
        '  push:',
        '    branches:',
        '      # the integration branch',
        '      - dev # not main',
      ].join('\n')
    );
    expect(refs.map((ref) => ref.name)).toEqual(['dev']);
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
