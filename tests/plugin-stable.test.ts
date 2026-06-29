/**
 * Plugin → Stable (1.15.0) tests — issue #145.
 *
 * The highest-risk area for a stable extensibility contract is **lifecycle
 * symmetry**: after `uninstall()`, a plugin must leave no directives, filters,
 * actions, or DI bindings behind. These tests prove that, plus the additive
 * `definePlugin()` authoring helper.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  applyFilters,
  definePlugin,
  getCustomDirective,
  getInstalledPlugins,
  hasProvided,
  isInstalled,
  resetPlugins,
  uninstall,
  use,
} from '../src/plugin/index';
import { listActions, listFilters } from '../src/plugin/hooks';

afterEach(() => resetPlugins());

describe('Plugin Stable — definePlugin authoring helper (#145)', () => {
  it('returns the plugin unchanged (identity) and installs', () => {
    const plugin = definePlugin({
      name: 'identity-plugin',
      version: '1.0.0',
      install(ctx) {
        ctx.provide('token', 42);
      },
    });
    expect(plugin.name).toBe('identity-plugin');
    use(plugin);
    expect(isInstalled('identity-plugin')).toBe(true);
  });
});

describe('Plugin Stable — install/uninstall symmetry (#145)', () => {
  it('removes every directive, filter, action, and DI binding on uninstall', () => {
    const plugin = definePlugin({
      name: 'kitchen-sink',
      install(ctx) {
        ctx.directive('my:thing', (el) => {
          el.textContent = 'x';
        });
        ctx.addFilter('view:render', (html: string) => `${html}!`);
        ctx.addAction('app:ready', () => {});
        ctx.provide('service', { ok: true });
      },
    });

    use(plugin);
    // Everything is registered.
    expect(getCustomDirective('my:thing')).toBeDefined();
    expect(listFilters()).toContain('view:render');
    expect(listActions()).toContain('app:ready');
    expect(hasProvided('service')).toBe(true);
    expect(applyFilters('view:render', 'hi')).toBe('hi!');

    const removed = uninstall('kitchen-sink');
    expect(removed).toBe(true);

    // ...and nothing is left behind — full symmetry.
    expect(getCustomDirective('my:thing')).toBeUndefined();
    expect(listFilters()).not.toContain('view:render');
    expect(listActions()).not.toContain('app:ready');
    expect(hasProvided('service')).toBe(false);
    expect(applyFilters('view:render', 'hi')).toBe('hi'); // filter no longer applies
    expect(isInstalled('kitchen-sink')).toBe(false);
  });

  it('runs onCleanup callbacks exactly once on uninstall', () => {
    let cleanups = 0;
    use(
      definePlugin({
        name: 'cleanup-plugin',
        install(ctx) {
          ctx.onCleanup(() => {
            cleanups += 1;
          });
        },
      })
    );
    expect(cleanups).toBe(0);
    uninstall('cleanup-plugin');
    expect(cleanups).toBe(1);
    uninstall('cleanup-plugin'); // already gone — no double cleanup
    expect(cleanups).toBe(1);
  });

  it('re-install after uninstall is clean (no leaked state)', () => {
    const make = () =>
      definePlugin({
        name: 'reinstall',
        install(ctx) {
          ctx.directive('ns:widget', (el) => {
            el.textContent = 'w';
          });
        },
      });

    use(make());
    expect(getCustomDirective('ns:widget')).toBeDefined();
    uninstall('reinstall');
    expect(getCustomDirective('ns:widget')).toBeUndefined();
    // A fresh install succeeds because the prior directive was fully removed.
    expect(() => use(make())).not.toThrow();
    expect(getCustomDirective('ns:widget')).toBeDefined();
  });

  it('uninstall returns false for an unknown plugin', () => {
    expect(uninstall('never-installed')).toBe(false);
  });

  it('resetPlugins tears down all installed plugins', () => {
    use(definePlugin({ name: 'a', install: (ctx) => ctx.provide('ka', 1) }));
    use(definePlugin({ name: 'b', install: (ctx) => ctx.provide('kb', 2) }));
    expect(getInstalledPlugins().length).toBeGreaterThanOrEqual(2);
    resetPlugins();
    expect(getInstalledPlugins().length).toBe(0);
    expect(hasProvided('ka')).toBe(false);
    expect(hasProvided('kb')).toBe(false);
  });
});

describe('Plugin Stable — namespaced directive conventions (#145)', () => {
  it('accepts namespace:variant directive names and rejects the bq- prefix', () => {
    use(
      definePlugin({
        name: 'ns-plugin',
        install(ctx) {
          ctx.directive('tooltip:arrow', (el) => {
            el.textContent = 'a';
          });
        },
      })
    );
    expect(getCustomDirective('tooltip:arrow')).toBeDefined();

    expect(() =>
      use(
        definePlugin({
          name: 'bad-prefix',
          install(ctx) {
            ctx.directive('bq-tooltip', () => {});
          },
        })
      )
    ).toThrow(/without the "bq-" prefix/);
  });
});
