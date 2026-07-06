/**
 * View compiler tests — issue #138.
 *
 * Validates the optional ahead-of-time compiler: expression rewriting (and its
 * conservative bail-outs), template walking, module emission, the runtime
 * registration hook, and the CLI.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { signal } from '../src/reactive/index';
import {
  clearCompiledExpressions,
  mount,
  registerCompiledExpressions,
} from '../src/view/index';
import {
  compileExpression,
  compileFiles,
  compileToModule,
  compileViews,
  emitModule,
  runCompileCli,
} from '../src/view/compiler/index';

/** Indirect eval to instantiate emitted arrow source in a non-strict scope. */
const instantiate = (code: string): ((ctx: Record<string, unknown>) => unknown) =>
  (0, eval)(code) as (ctx: Record<string, unknown>) => unknown;

afterEach(() => clearCompiledExpressions());

describe('compileExpression — supported forms (#138)', () => {
  const ok = (expr: string) => {
    const r = compileExpression(expr);
    if (!r.ok) throw new Error(`expected ${expr} to compile, got: ${r.reason}`);
    return r.code;
  };

  it('rewrites free identifiers to context reads', () => {
    expect(ok('count + 1')).toBe('(__bq_ctx) => (__bq_ctx.count + 1)');
    expect(instantiate(ok('count + 1'))({ count: 5 })).toBe(6);
  });

  it('leaves member-access property names alone', () => {
    expect(instantiate(ok('user.profile.name'))({ user: { profile: { name: 'Ada' } } })).toBe('Ada');
  });

  it('handles ternaries and comparisons', () => {
    const fn = instantiate(ok("age >= 18 ? 'adult' : 'minor'"));
    expect(fn({ age: 20 })).toBe('adult');
    expect(fn({ age: 5 })).toBe('minor');
  });

  it('compiles object literals (explicit + shorthand keys)', () => {
    expect(instantiate(ok('{ active: isActive }'))({ isActive: true })).toEqual({ active: true });
    expect(instantiate(ok('{ active }'))({ active: 7 })).toEqual({ active: 7 });
    expect(instantiate(ok('{ a: x, b }'))({ x: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('keeps known globals un-prefixed', () => {
    expect(ok('Math.round(x)')).toBe('(__bq_ctx) => (Math.round(__bq_ctx.x))');
    expect(instantiate(ok('Math.max(a, b)'))({ a: 2, b: 9 })).toBe(9);
  });

  it('handles calls, arrays, optional chaining and string literals', () => {
    expect(instantiate(ok('fn(a, b)'))({ fn: (x: number, y: number) => x + y, a: 2, b: 3 })).toBe(5);
    expect(instantiate(ok('[a, b]'))({ a: 1, b: 2 })).toEqual([1, 2]);
    expect(instantiate(ok('user?.name'))({ user: null })).toBeUndefined();
    expect(instantiate(ok("greeting + '!'"))({ greeting: 'hi' })).toBe('hi!');
  });

  it('allows increment in event-style expressions', () => {
    const r = compileExpression('count.value++');
    expect(r.ok).toBe(true);
  });

  it('extends the global allow-list via options', () => {
    const r = compileExpression('localStorage.getItem(k)', { globals: ['localStorage'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code).toBe('(__bq_ctx) => (localStorage.getItem(__bq_ctx.k))');
  });
});

describe('compileExpression — conservative bail-outs (#138)', () => {
  const bail = (expr: string) => {
    const r = compileExpression(expr);
    expect(r.ok).toBe(false);
  };

  it('bails on assignments, arrows, new, spread, regex, templates, comments', () => {
    bail('x = 1');
    bail('x => x + 1');
    bail('new Date()');
    bail('{ ...rest }');
    bail('/abc/.test(s)');
    bail('`hello ${name}`');
    bail('a /* c */ + b');
    bail('');
  });

  it('bails on member access to constructor/prototype/__proto__ (#202)', () => {
    bail("foo.constructor.constructor('return 2')()");
    bail('foo?.constructor');
    bail("foo['prototype']");
    bail('foo.__proto__');
    // Non-dangerous member chains still compile.
    expect(compileExpression('user.profile.name').ok).toBe(true);
  });

  it('bails on unterminated string literals instead of emitting broken code (#170)', () => {
    bail("'oops");
    bail('"unclosed');
    bail("greeting + 'tail");
    // A valid closing quote after escapes still compiles.
    const r = compileExpression("'a\\'b'");
    expect(r.ok).toBe(true);
  });

  it('bails on invalid numeric literals (#170)', () => {
    bail('1ex');
    bail('1e');
    bail('0xG1');
    // Legacy leading-zero forms are SyntaxErrors in strict/module code.
    bail('007');
    bail('01.5');
    bail('00');
    // Valid numerics still compile.
    for (const n of ['0', '1', '1.5', '0.5', '0xFF', '1e3', '1_000', '.5', '0b1010', '5.']) {
      const r = compileExpression(n);
      expect(r.ok).toBe(true);
    }
  });
});

describe('compileViews — template walking (#138)', () => {
  it('collects expressions, mirrors directive eval strategies, and reports skips', () => {
    const template = `
      <div>
        <p bq-text="count + 1"></p>
        <span bq-class="{ active: isActive, busy }"></span>
        <button bq-on:click="count = count + 1">+</button>
        <ul><li bq-for="item in items" bq-key="item.id" bq-text="item.name"></li></ul>
      </div>`;
    const { expressions, stats } = compileViews(template);

    // Whole-value, object-split, and for list/key sub-expressions all present.
    expect(expressions['count + 1']).toBeDefined();
    expect(expressions['isActive']).toBeDefined();
    expect(expressions['busy']).toBeDefined();
    expect(expressions['items']).toBeDefined();
    expect(expressions['item.id']).toBeDefined();
    expect(expressions['item.name']).toBeDefined();

    // The assignment in bq-on falls back to runtime.
    expect(stats.skipped.some((s) => s.expression === 'count = count + 1')).toBe(true);
    expect(stats.compiled).toBe(Object.keys(expressions).length);
    expect(stats.total).toBe(stats.compiled + stats.skipped.length);
  });

  it('respects a custom prefix', () => {
    const { expressions } = compileViews('<p x-text="value"></p>', { prefix: 'x' });
    expect(expressions['value']).toBeDefined();
  });
});

describe('emitModule / compileToModule (#138)', () => {
  it('emits an importable registration module', () => {
    const { code } = compileToModule('<p bq-text="count"></p>');
    expect(code).toContain('import { registerCompiledExpressions }');
    expect(code).toContain('@bquery/bquery/view');
    expect(code).toContain('"count"');
  });

  it('emits a valid no-op module when nothing compiles', () => {
    const { code, stats } = compileToModule('<p bq-text="x = 1"></p>');
    expect(stats.compiled).toBe(0);
    expect(code).toContain('export {}');
    expect(code).not.toContain('registerCompiledExpressions(');
  });

  it('supports a custom import specifier', () => {
    const code = emitModule(compileViews('<p bq-text="count"></p>'), '#app/view');
    expect(code).toContain('"#app/view"');
  });
});

describe('runtime registration hook (#138)', () => {
  it('prefers a registered compiled function over the runtime evaluator', () => {
    registerCompiledExpressions({ sentinelExpr: () => 'COMPILED' });
    const root = document.createElement('div');
    root.innerHTML = '<p bq-text="sentinelExpr"></p>';
    document.body.appendChild(root);
    const view = mount(root, { sentinelExpr: signal('runtime') });
    expect(root.querySelector('p')!.textContent).toBe('COMPILED');
    view.destroy();
  });

  it('falls back to runtime after clearing', () => {
    registerCompiledExpressions({ sentinelExpr2: () => 'COMPILED' });
    clearCompiledExpressions();
    const root = document.createElement('div');
    root.innerHTML = '<p bq-text="sentinelExpr2"></p>';
    document.body.appendChild(root);
    const view = mount(root, { sentinelExpr2: signal('runtime') });
    expect(root.querySelector('p')!.textContent).toBe('runtime');
    view.destroy();
  });

  it('compiled output is behaviourally identical to runtime evaluation', () => {
    // Compile, register, and verify the emitted function matches the source.
    const { expressions } = compileViews('<p bq-text="a * 2 + b"></p>');
    const fn = instantiate(expressions['a * 2 + b']);
    expect(fn({ a: 3, b: 4 })).toBe(10);

    registerCompiledExpressions({ 'a * 2 + b': fn as (ctx: Record<string, unknown>) => unknown });
    const root = document.createElement('div');
    root.innerHTML = '<p bq-text="a * 2 + b"></p>';
    document.body.appendChild(root);
    const view = mount(root, { a: signal(3), b: signal(4) });
    expect(root.querySelector('p')!.textContent).toBe('10');
    view.destroy();
  });
});

describe('CLI (#138)', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = '';
    }
  });

  it('compiles a file to a module beside it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bq-view-compile-'));
    const input = join(dir, 'home.html');
    await writeFile(input, '<p bq-text="count + 1"></p>', 'utf8');

    const results = await compileFiles([input], {});
    expect(results.length).toBe(1);
    const out = await readFile(results[0].output, 'utf8');
    expect(out).toContain('registerCompiledExpressions');
    expect(out).toContain('count + 1');
    expect(results[0].stats.compiled).toBe(1);
  });

  it('runCompileCli reports per-file coverage and returns 0', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bq-view-cli-'));
    const input = join(dir, 'view.html');
    await writeFile(input, '<p bq-text="value"></p>', 'utf8');

    const logs: string[] = [];
    const code = await runCompileCli([input, '--out-dir', dir], {
      log: (m) => logs.push(m),
      error: (m) => logs.push(m),
    });
    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('compiled');
  });

  it('returns 1 with no input files', async () => {
    const errors: string[] = [];
    const code = await runCompileCli([], { log: () => {}, error: (m) => errors.push(m) });
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('No input files');
  });
});
