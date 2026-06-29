/**
 * i18n message-extraction tooling tests — issue #141.
 *
 * Covers source scanning (`defineMessages` catalogs + `t()`/`tc()` calls),
 * flatten/unflatten round-tripping, translation-preserving merge, and the CLI
 * (glob expansion + writing a JSON catalog) against the OS temp dir.
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractFromSource,
  flatten,
  unflatten,
  mergeCatalog,
  extractFiles,
  runExtractCli,
} from '../src/i18n/extract/index';

const tmpDirs: string[] = [];
const makeTmp = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'bq-i18n-'));
  tmpDirs.push(dir);
  return dir;
};

afterAll(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
});

describe('extractFromSource (#141)', () => {
  it('extracts defineMessages catalogs with their default strings', () => {
    const src = `
      import { defineMessages } from '@bquery/bquery/i18n';
      export const messages = defineMessages({
        cart: {
          items: '{count, plural, one {# item} other {# items}}',
          empty: 'Your cart is empty',
        },
        greeting: "Hello, {name}!",
      });
    `;
    const result = extractFromSource(src);
    const map = new Map(result.map((e) => [e.key, e.value]));
    expect(map.get('cart.items')).toBe('{count, plural, one {# item} other {# items}}');
    expect(map.get('cart.empty')).toBe('Your cart is empty');
    expect(map.get('greeting')).toBe('Hello, {name}!');
  });

  it('extracts t() / tc() call keys with empty defaults', () => {
    const src = `
      i18n.t('user.welcome', { name });
      const label = tc('user.farewell');
      el.textContent = t("nav.home");
    `;
    const map = new Map(extractFromSource(src).map((e) => [e.key, e.value]));
    expect(map.has('user.welcome')).toBe(true);
    expect(map.get('user.welcome')).toBe('');
    expect(map.has('user.farewell')).toBe(true);
    expect(map.has('nav.home')).toBe(true);
  });

  it('matches instance calls (`i18n.t(`) but not unrelated identifiers', () => {
    const src = `
      const formatted = format('x');     // ends in 't' but not a t() call
      const connect = connect('y');
      i18n.t('real.key');
    `;
    const keys = extractFromSource(src).map((e) => e.key);
    expect(keys).toContain('real.key');
    expect(keys).not.toContain('x');
    expect(keys).not.toContain('y');
  });

  it('ignores comments and non-string values', () => {
    const src = `
      defineMessages({
        // a comment with t('not.a.key')
        valid: 'ok',
        count: 5,
        fn: () => 'nope',
      });
    `;
    const map = new Map(extractFromSource(src).map((e) => [e.key, e.value]));
    expect(map.get('valid')).toBe('ok');
    expect(map.has('count')).toBe(false);
    expect(map.has('fn')).toBe(false);
    expect(map.has('not.a.key')).toBe(false);
  });
});

describe('flatten / unflatten (#141)', () => {
  it('round-trips a nested catalog', () => {
    const catalog = { a: { b: 'x', c: { d: 'y' } }, e: 'z' };
    const flat = flatten(catalog);
    expect(new Map(flat.map((m) => [m.key, m.value])).get('a.c.d')).toBe('y');
    expect(unflatten(flat)).toEqual(catalog);
  });
});

describe('mergeCatalog (#141)', () => {
  it('preserves existing translations and adds new keys', () => {
    const existing = { greeting: 'Hallo', nav: { home: 'Startseite' } };
    const extracted = [
      { key: 'greeting', value: 'Hello' },
      { key: 'nav.home', value: '' },
      { key: 'nav.about', value: '' },
    ];
    const { catalog, added, kept } = mergeCatalog(existing, extracted);
    expect(catalog.greeting as string).toBe('Hallo'); // not overwritten
    expect((catalog.nav as Record<string, string>).about).toBe('');
    expect(added).toEqual(['nav.about']);
    expect(kept).toBe(2);
  });

  it('keeps stale keys by default but prunes when asked', () => {
    const existing = { used: 'A', stale: 'B' };
    const extracted = [{ key: 'used', value: '' }];
    expect(mergeCatalog(existing, extracted).catalog.stale).toBe('B');
    const pruned = mergeCatalog(existing, extracted, { prune: true });
    expect(pruned.catalog.stale).toBeUndefined();
    expect(pruned.removed).toEqual(['stale']);
  });
});

describe('extractFiles + CLI (#141)', () => {
  it('scans files and writes a merged JSON catalog', async () => {
    const dir = await makeTmp();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, 'src', 'a.ts'),
      `defineMessages({ cart: { items: '{count, plural, one {# item} other {# items}}' } });`
    );
    await writeFile(join(dir, 'src', 'b.ts'), `t('nav.home'); tc('nav.about');`);

    const out = join(dir, 'locales', 'en.json');
    const result = await extractFiles([join(dir, 'src', 'a.ts'), join(dir, 'src', 'b.ts')], {
      out,
    });

    expect(result.files).toBe(2);
    const written = JSON.parse(await readFile(out, 'utf8'));
    expect(written.cart.items).toContain('plural');
    expect(written.nav.home).toBe('');
    expect(written.nav.about).toBe('');
  });

  it('runExtractCli expands globs and reports a summary', async () => {
    const dir = await makeTmp();
    await mkdir(join(dir, 'src', 'deep'), { recursive: true });
    await writeFile(join(dir, 'src', 'deep', 'c.ts'), `t('deep.key');`);

    const logs: string[] = [];
    const errors: string[] = [];
    const out = join(dir, 'out.json');
    const code = await runExtractCli(['extract', `${dir}/src/**/*.ts`, '--out', out], {
      log: (m) => logs.push(m),
      error: (m) => errors.push(m),
    });

    expect(code).toBe(0);
    expect(errors).toHaveLength(0);
    const written = JSON.parse(await readFile(out, 'utf8'));
    expect(written.deep.key).toBe('');
    expect(logs.some((l) => l.includes('1 new'))).toBe(true);
  });

  it('returns a usage error when no patterns are given', async () => {
    const errors: string[] = [];
    const code = await runExtractCli([], { log: () => {}, error: (m) => errors.push(m) });
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('No input patterns');
  });
});
