/**
 * Tests for the 1.14+ plugin module extensions.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  addAction,
  addFilter,
  applyFilters,
  createInjectionKey,
  doAction,
  getInstalledPlugins,
  getPluginInfo,
  hasProvided,
  inject,
  listActions,
  listFilters,
  provide,
  removeAction,
  removeFilter,
  resetDi,
  resetHooks,
  resetPlugins,
  unuse,
  use,
} from '../src/plugin/index';
import type { BQueryPlugin } from '../src/plugin/index';

afterEach(() => {
  resetPlugins();
  resetHooks();
  resetDi();
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('plugin/hooks/addFilter', () => {
  it('returns the original value when no filters are registered', () => {
    expect(applyFilters('noop', 5)).toBe(5);
  });

  it('applies filters in priority order', () => {
    addFilter<number>('double', (v) => v * 2, 20);
    addFilter<number>('double', (v) => v + 1, 10);
    expect(applyFilters('double', 3)).toBe(8); // (3+1)*2
  });

  it('removeFilter removes a registered callback', () => {
    const fn = (v: number): number => v + 10;
    addFilter<number>('inc', fn);
    expect(applyFilters('inc', 1)).toBe(11);
    expect(removeFilter('inc', fn)).toBe(true);
    expect(applyFilters('inc', 1)).toBe(1);
  });

  it('listFilters reports current filter names', () => {
    addFilter('a', (v) => v);
    addFilter('b', (v) => v);
    expect(listFilters().sort()).toEqual(['a', 'b']);
  });

  it('catches filter callback errors without breaking the chain', () => {
    addFilter<number>('chain', () => {
      throw new Error('bad');
    });
    addFilter<number>('chain', (v) => v + 1, 20);
    expect(applyFilters('chain', 1)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

describe('plugin/hooks/addAction', () => {
  it('dispatches actions in priority order', () => {
    const calls: string[] = [];
    addAction('event', () => calls.push('b'), 20);
    addAction('event', () => calls.push('a'), 10);
    doAction('event');
    expect(calls).toEqual(['a', 'b']);
  });

  it('removeAction removes a callback', () => {
    const fn = (): void => {
      throw new Error('should not run');
    };
    addAction('boom', fn);
    expect(removeAction('boom', fn)).toBe(true);
    expect(() => doAction('boom')).not.toThrow();
  });

  it('listActions reports current action names', () => {
    addAction('a', () => undefined);
    expect(listActions()).toContain('a');
  });
});

// ---------------------------------------------------------------------------
// DI
// ---------------------------------------------------------------------------

describe('plugin/di', () => {
  it('provide / inject round-trips a value', () => {
    const Key = createInjectionKey<{ ping: () => string }>('test');
    provide(Key, { ping: () => 'pong' });
    expect(inject(Key)?.ping()).toBe('pong');
    expect(hasProvided(Key)).toBe(true);
  });

  it('returns undefined for unprovided keys', () => {
    expect(inject('unknown-key')).toBeUndefined();
  });

  it('resetDi clears the container', () => {
    provide('greeting', 'hi');
    resetDi();
    expect(inject('greeting')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Plugin lifecycle: install/uninstall + cleanup tracking
// ---------------------------------------------------------------------------

describe('plugin/use + unuse', () => {
  it('runs onCleanup callbacks when the plugin is uninstalled', () => {
    let cleaned = 0;
    const plugin: BQueryPlugin = {
      name: 'with-cleanup',
      install(ctx) {
        ctx.onCleanup(() => cleaned++);
      },
    };
    use(plugin);
    expect(unuse('with-cleanup')).toBe(true);
    expect(cleaned).toBe(1);
    expect(unuse('with-cleanup')).toBe(false);
  });

  it('removes plugin-owned directives on uninstall', () => {
    const plugin: BQueryPlugin = {
      name: 'with-directive',
      install(ctx) {
        ctx.directive('test-dir', () => undefined);
      },
    };
    use(plugin);
    expect(getInstalledPlugins()).toContain('with-directive');
    unuse('with-directive');
    expect(getInstalledPlugins()).not.toContain('with-directive');
  });

  it('removes plugin-owned filters / actions / DI on uninstall', () => {
    const Key = createInjectionKey<string>('shared');
    const plugin: BQueryPlugin = {
      name: 'with-hooks',
      install(ctx) {
        ctx.addFilter<number>('hook-filter', (v) => v + 1);
        ctx.addAction('hook-action', () => undefined);
        ctx.provide(Key, 'value');
      },
    };
    use(plugin);
    expect(applyFilters('hook-filter', 1)).toBe(2);
    expect(inject(Key)).toBe('value');
    unuse('with-hooks');
    expect(applyFilters('hook-filter', 1)).toBe(1);
    expect(inject(Key)).toBeUndefined();
  });

  it('supports lifecycle directives via { mounted, unmounted }', () => {
    let mounted = 0;
    const plugin: BQueryPlugin = {
      name: 'with-lifecycle',
      install(ctx) {
        ctx.directive('life', {
          mounted: () => mounted++,
          unmounted: () => undefined,
        });
      },
    };
    use(plugin);
    expect(mounted).toBe(0);
  });

  it('accepts namespaced directive names like "tooltip:arrow"', () => {
    const plugin: BQueryPlugin = {
      name: 'namespaced',
      install(ctx) {
        ctx.directive('tooltip:arrow', () => undefined);
      },
    };
    expect(() => use(plugin)).not.toThrow();
  });

  it('rejects invalid directive identifiers', () => {
    const plugin: BQueryPlugin = {
      name: 'bad-name',
      install(ctx) {
        ctx.directive('not valid!', () => undefined);
      },
    };
    expect(() => use(plugin)).toThrow(/not a valid directive identifier/);
  });
});

// ---------------------------------------------------------------------------
// Plugin metadata
// ---------------------------------------------------------------------------

describe('plugin/metadata', () => {
  it('exposes metadata via getPluginInfo()', () => {
    const plugin: BQueryPlugin = {
      name: 'meta-plugin',
      version: '2.0.0',
      description: 'A test plugin',
      install: () => undefined,
    };
    use(plugin);
    const info = getPluginInfo('meta-plugin');
    expect(info?.version).toBe('2.0.0');
    expect(info?.description).toBe('A test plugin');
  });

  it('getInstalledPlugins({ withMetadata: true }) returns rich entries', () => {
    use({ name: 'a', version: '1.0.0', install: () => undefined });
    use({ name: 'b', install: () => undefined });
    const info = getInstalledPlugins({ withMetadata: true });
    expect(info.length).toBe(2);
    expect(info.find((p) => p.name === 'a')?.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

describe('plugin/dependencies', () => {
  it('throws when dependencies are missing in default mode', () => {
    expect(() =>
      use({
        name: 'needs-dep',
        dependencies: ['missing-plugin'],
        install: () => undefined,
      })
    ).toThrow(/missing dependencies/);
  });

  it('warns instead of throwing when dependencyMode is "warn"', () => {
    let warned = false;
    const originalWarn = console.warn;
    console.warn = (): void => {
      warned = true;
    };
    try {
      use({
        name: 'warn-dep',
        dependencies: ['missing-plugin'],
        dependencyMode: 'warn',
        install: () => undefined,
      });
    } finally {
      console.warn = originalWarn;
    }
    expect(warned).toBe(true);
    expect(getInstalledPlugins()).toContain('warn-dep');
  });

  it('installs successfully when dependencies are satisfied', () => {
    use({ name: 'base-plugin', install: () => undefined });
    expect(() =>
      use({
        name: 'dependent',
        dependencies: ['base-plugin'],
        install: () => undefined,
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Async install
// ---------------------------------------------------------------------------

describe('plugin/async install', () => {
  it('returns a promise when install is async', async () => {
    let installed = false;
    const plugin: BQueryPlugin = {
      name: 'async-plugin',
      install: async (): Promise<void> => {
        await Promise.resolve();
        installed = true;
      },
    };
    const result = use(plugin);
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(installed).toBe(true);
    expect(getInstalledPlugins()).toContain('async-plugin');
  });

  it('returns void for synchronous installs', () => {
    const result = use({
      name: 'sync-plugin',
      install: () => undefined,
    });
    expect(result).toBeUndefined();
  });

  it('serialises concurrent async installs of the same plugin', async () => {
    let installCount = 0;
    const plugin: BQueryPlugin = {
      name: 'concurrent',
      install: async (): Promise<void> => {
        await Promise.resolve();
        installCount++;
      },
    };
    const [a, b] = [use(plugin), use(plugin)];
    await Promise.all([a, b].filter((p): p is Promise<void> => !!p));
    expect(installCount).toBe(1);
  });
});
