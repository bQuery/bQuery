import { afterEach, describe, expect, it } from 'bun:test';
import {
  use,
  isInstalled,
  getInstalledPlugins,
  getCustomDirective,
  getCustomDirectives,
  resetPlugins,
} from '../src/plugin/index';
import type {
  BQueryPlugin,
  CustomDirectiveHandler,
  PluginInstallContext,
} from '../src/plugin/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(() => {
  resetPlugins();
});

/**
 * Create a minimal valid plugin.
 */
const makePlugin = (
  name: string,
  installFn?: (ctx: PluginInstallContext, opts?: unknown) => void
): BQueryPlugin => ({
  name,
  install: installFn ?? (() => {}),
});

// ============================================================================
// use() — registration
// ============================================================================

describe('Plugin System', () => {
  describe('use()', () => {
    it('should install a valid plugin', () => {
      const plugin = makePlugin('test-plugin');
      use(plugin);
      expect(isInstalled('test-plugin')).toBe(true);
    });

    it('should call install with a PluginInstallContext', () => {
      let receivedCtx: PluginInstallContext | undefined;
      const plugin = makePlugin('ctx-test', (ctx) => {
        receivedCtx = ctx;
      });
      use(plugin);
      expect(receivedCtx).toBeDefined();
      expect(typeof receivedCtx!.directive).toBe('function');
      expect(typeof receivedCtx!.component).toBe('function');
    });

    it('should forward options to install()', () => {
      let receivedOpts: unknown;
      const plugin: BQueryPlugin<{ color: string }> = {
        name: 'opts-test',
        install(_ctx, opts) {
          receivedOpts = opts;
        },
      };
      use(plugin, { color: 'red' });
      expect(receivedOpts).toEqual({ color: 'red' });
    });

    it('should not install the same plugin twice', () => {
      let installCount = 0;
      const plugin = makePlugin('dedup', () => {
        installCount++;
      });
      use(plugin);
      use(plugin);
      use(plugin);
      expect(installCount).toBe(1);
    });

    it('should throw for null/undefined plugin', () => {
      expect(() => use(null as any)).toThrow('[bq] use() expects a plugin object');
      expect(() => use(undefined as any)).toThrow('[bq] use() expects a plugin object');
    });

    it('should throw for non-object plugin', () => {
      expect(() => use('bad' as any)).toThrow('[bq] use() expects a plugin object');
      expect(() => use(42 as any)).toThrow('[bq] use() expects a plugin object');
    });

    it('should throw for plugin without name', () => {
      expect(() => use({ install() {} } as any)).toThrow('non-empty "name"');
    });

    it('should throw for plugin with empty name', () => {
      expect(() => use({ name: '', install() {} } as any)).toThrow('non-empty "name"');
    });

    it('should throw for plugin without install function', () => {
      expect(() => use({ name: 'no-install' } as any)).toThrow('"install" function');
    });

    it('should throw for plugin with non-function install', () => {
      expect(() => use({ name: 'bad-install', install: 'not-fn' } as any)).toThrow(
        '"install" function'
      );
    });
  });

  // ==========================================================================
  // isInstalled()
  // ==========================================================================

  describe('isInstalled()', () => {
    it('should return false for unknown plugin', () => {
      expect(isInstalled('unknown')).toBe(false);
    });

    it('should return true after installation', () => {
      use(makePlugin('my-plugin'));
      expect(isInstalled('my-plugin')).toBe(true);
    });

    it('should return false after reset', () => {
      use(makePlugin('reset-me'));
      expect(isInstalled('reset-me')).toBe(true);
      resetPlugins();
      expect(isInstalled('reset-me')).toBe(false);
    });
  });

  // ==========================================================================
  // getInstalledPlugins()
  // ==========================================================================

  describe('getInstalledPlugins()', () => {
    it('should return empty array when no plugins installed', () => {
      expect(getInstalledPlugins()).toEqual([]);
    });

    it('should return names of installed plugins', () => {
      use(makePlugin('alpha'));
      use(makePlugin('beta'));
      expect(getInstalledPlugins()).toEqual(['alpha', 'beta']);
    });

    it('should return a snapshot (not a live reference)', () => {
      use(makePlugin('snap'));
      const list1 = getInstalledPlugins();
      use(makePlugin('snap2'));
      const list2 = getInstalledPlugins();
      expect(list1).toEqual(['snap']);
      expect(list2).toEqual(['snap', 'snap2']);
    });
  });

  // ==========================================================================
  // Custom Directives via ctx.directive()
  // ==========================================================================

  describe('custom directives', () => {
    it('should register a directive via install context', () => {
      const handler: CustomDirectiveHandler = () => {};
      use({
        name: 'dir-plugin',
        install(ctx) {
          ctx.directive('tooltip', handler);
        },
      });
      expect(getCustomDirective('tooltip')).toBe(handler);
    });

    it('should list all registered directives', () => {
      use({
        name: 'multi-dir',
        install(ctx) {
          ctx.directive('focus', () => {});
          ctx.directive('scroll', () => {});
        },
      });
      const dirs = getCustomDirectives();
      expect(dirs.length).toBe(2);
      expect(dirs.map((d) => d.name).sort()).toEqual(['focus', 'scroll']);
    });

    it('should return undefined for unregistered directive', () => {
      expect(getCustomDirective('nonexistent')).toBeUndefined();
    });

    it('should overwrite a directive if registered again', () => {
      const handler1: CustomDirectiveHandler = () => {};
      const handler2: CustomDirectiveHandler = () => {};
      use({
        name: 'p1',
        install(ctx) {
          ctx.directive('dup', handler1);
        },
      });
      // Second plugin overwrites
      resetPlugins(); // reset to allow re-install
      use({
        name: 'p2',
        install(ctx) {
          ctx.directive('dup', handler2);
        },
      });
      expect(getCustomDirective('dup')).toBe(handler2);
    });

    it('should throw for empty directive name', () => {
      expect(() => {
        use({
          name: 'bad-dir',
          install(ctx) {
            ctx.directive('', () => {});
          },
        });
      }).toThrow('non-empty string');
    });

    it('should throw for non-function handler', () => {
      expect(() => {
        use({
          name: 'bad-handler',
          install(ctx) {
            ctx.directive('test', 'not-a-fn' as any);
          },
        });
      }).toThrow('must be a function');
    });

    it('should clear directives on reset', () => {
      use({
        name: 'reset-dir',
        install(ctx) {
          ctx.directive('temp', () => {});
        },
      });
      expect(getCustomDirective('temp')).toBeDefined();
      resetPlugins();
      expect(getCustomDirective('temp')).toBeUndefined();
      expect(getCustomDirectives()).toEqual([]);
    });
  });

  // ==========================================================================
  // Custom Components via ctx.component()
  // ==========================================================================

  describe('custom components', () => {
    it('should register a custom element', () => {
      class TestElement extends HTMLElement {}
      use({
        name: 'comp-plugin',
        install(ctx) {
          ctx.component('bq-test-widget', TestElement);
        },
      });
      expect(customElements.get('bq-test-widget')).toBe(TestElement);
    });

    it('should be idempotent (skip if already defined)', () => {
      class Widget1 extends HTMLElement {}
      class Widget2 extends HTMLElement {}
      use({
        name: 'idem-plugin',
        install(ctx) {
          ctx.component('bq-idem-widget', Widget1);
          // second call with different class — should not throw
          ctx.component('bq-idem-widget', Widget2);
        },
      });
      // First registration wins
      expect(customElements.get('bq-idem-widget')).toBe(Widget1);
    });

    it('should throw for empty tag name', () => {
      expect(() => {
        use({
          name: 'bad-tag',
          install(ctx) {
            ctx.component('', class extends HTMLElement {});
          },
        });
      }).toThrow('non-empty string');
    });

    it('should throw for non-function constructor', () => {
      expect(() => {
        use({
          name: 'bad-ctor',
          install(ctx) {
            ctx.component('bq-bad-ctor', 'not-a-class' as any);
          },
        });
      }).toThrow('must be a function');
    });
  });

  // ==========================================================================
  // View integration — custom directives in processElement
  // ==========================================================================

  describe('view integration', () => {
    it('should invoke custom directive handler when processing DOM elements', () => {
      // Import processElement and handlers from view module
      const {
        handleText,
        handleHtml,
        handleIf,
        handleShow,
        handleClass,
        handleStyle,
        handleModel,
        handleRef,
        createForHandler,
        handleBind,
        handleOn,
      } = require('../src/view/directives/index');
      const { processElement } = require('../src/view/process');

      const calls: Array<{ el: Element; expr: string }> = [];

      // Register a custom directive
      use({
        name: 'highlight-plugin',
        install(ctx) {
          ctx.directive('highlight', (el, expression) => {
            calls.push({ el, expr: expression });
          });
        },
      });

      // Create a DOM element with the custom directive
      const el = document.createElement('div');
      el.setAttribute('bq-highlight', 'yellow');

      const handlers = {
        text: handleText,
        html: handleHtml,
        if: handleIf,
        show: handleShow,
        class: handleClass,
        style: handleStyle,
        model: handleModel,
        ref: handleRef,
        for: createForHandler(processElement, () => {}),
        bind: (attrName: string) => handleBind.bind(null, attrName),
        on: (eventName: string) => handleOn.bind(null, eventName),
      };

      const cleanups: Array<() => void> = [];
      processElement(el, {}, 'bq', cleanups, handlers);

      expect(calls.length).toBe(1);
      expect(calls[0].el).toBe(el);
      expect(calls[0].expr).toBe('yellow');
    });

    it('should not invoke anything for unknown directives when no plugin registers them', () => {
      const { processElement } = require('../src/view/process');
      const {
        handleText,
        handleHtml,
        handleIf,
        handleShow,
        handleClass,
        handleStyle,
        handleModel,
        handleRef,
        createForHandler,
        handleBind,
        handleOn,
      } = require('../src/view/directives/index');

      const el = document.createElement('div');
      el.setAttribute('bq-unknown', 'test');

      const handlers = {
        text: handleText,
        html: handleHtml,
        if: handleIf,
        show: handleShow,
        class: handleClass,
        style: handleStyle,
        model: handleModel,
        ref: handleRef,
        for: createForHandler(processElement, () => {}),
        bind: (attrName: string) => handleBind.bind(null, attrName),
        on: (eventName: string) => handleOn.bind(null, eventName),
      };

      const cleanups: Array<() => void> = [];
      // Should not throw
      processElement(el, {}, 'bq', cleanups, handlers);
    });

    it('should pass cleanups to custom directive handler', () => {
      const { processElement } = require('../src/view/process');
      const {
        handleText,
        handleHtml,
        handleIf,
        handleShow,
        handleClass,
        handleStyle,
        handleModel,
        handleRef,
        createForHandler,
        handleBind,
        handleOn,
      } = require('../src/view/directives/index');

      let cleanedUp = false;

      use({
        name: 'cleanup-plugin',
        install(ctx) {
          ctx.directive('autoclean', (_el, _expr, _ctx, cleanups) => {
            cleanups.push(() => {
              cleanedUp = true;
            });
          });
        },
      });

      const el = document.createElement('div');
      el.setAttribute('bq-autoclean', 'test');

      const handlers = {
        text: handleText,
        html: handleHtml,
        if: handleIf,
        show: handleShow,
        class: handleClass,
        style: handleStyle,
        model: handleModel,
        ref: handleRef,
        for: createForHandler(processElement, () => {}),
        bind: (attrName: string) => handleBind.bind(null, attrName),
        on: (eventName: string) => handleOn.bind(null, eventName),
      };

      const cleanups: Array<() => void> = [];
      processElement(el, {}, 'bq', cleanups, handlers);

      expect(cleanups.length).toBe(1);
      cleanups[0]();
      expect(cleanedUp).toBe(true);
    });

    it('should pass the binding context to custom directive handler', () => {
      const { processElement } = require('../src/view/process');
      const {
        handleText,
        handleHtml,
        handleIf,
        handleShow,
        handleClass,
        handleStyle,
        handleModel,
        handleRef,
        createForHandler,
        handleBind,
        handleOn,
      } = require('../src/view/directives/index');

      let receivedContext: Record<string, unknown> | undefined;

      use({
        name: 'context-plugin',
        install(ctx) {
          ctx.directive('contextcheck', (_el, _expr, context) => {
            receivedContext = context;
          });
        },
      });

      const el = document.createElement('div');
      el.setAttribute('bq-contextcheck', 'test');

      const myContext = { foo: 'bar', count: 42 };

      const handlers = {
        text: handleText,
        html: handleHtml,
        if: handleIf,
        show: handleShow,
        class: handleClass,
        style: handleStyle,
        model: handleModel,
        ref: handleRef,
        for: createForHandler(processElement, () => {}),
        bind: (attrName: string) => handleBind.bind(null, attrName),
        on: (eventName: string) => handleOn.bind(null, eventName),
      };

      processElement(el, myContext, 'bq', [], handlers);

      expect(receivedContext).toBe(myContext);
    });
  });

  // ==========================================================================
  // resetPlugins()
  // ==========================================================================

  describe('resetPlugins()', () => {
    it('should clear all plugins and directives', () => {
      use({
        name: 'full-reset',
        install(ctx) {
          ctx.directive('d1', () => {});
          ctx.directive('d2', () => {});
        },
      });
      use(makePlugin('extra'));

      expect(getInstalledPlugins().length).toBe(2);
      expect(getCustomDirectives().length).toBe(2);

      resetPlugins();

      expect(getInstalledPlugins()).toEqual([]);
      expect(getCustomDirectives()).toEqual([]);
    });

    it('should allow re-installation after reset', () => {
      const plugin = makePlugin('reinstall');
      use(plugin);
      expect(isInstalled('reinstall')).toBe(true);
      resetPlugins();
      expect(isInstalled('reinstall')).toBe(false);
      use(plugin);
      expect(isInstalled('reinstall')).toBe(true);
    });
  });

  // ==========================================================================
  // Multiple plugins
  // ==========================================================================

  describe('multiple plugins', () => {
    it('should install multiple plugins independently', () => {
      use(makePlugin('plugin-a'));
      use(makePlugin('plugin-b'));
      use(makePlugin('plugin-c'));
      expect(getInstalledPlugins()).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('should allow different plugins to register different directives', () => {
      use({
        name: 'p-a',
        install(ctx) {
          ctx.directive('a-dir', () => {});
        },
      });
      use({
        name: 'p-b',
        install(ctx) {
          ctx.directive('b-dir', () => {});
        },
      });
      expect(getCustomDirective('a-dir')).toBeDefined();
      expect(getCustomDirective('b-dir')).toBeDefined();
    });
  });

  // ==========================================================================
  // Type exports
  // ==========================================================================

  describe('type exports', () => {
    it('should export all expected types', async () => {
      const mod = await import('../src/plugin/index');
      expect(typeof mod.use).toBe('function');
      expect(typeof mod.isInstalled).toBe('function');
      expect(typeof mod.getInstalledPlugins).toBe('function');
      expect(typeof mod.getCustomDirective).toBe('function');
      expect(typeof mod.getCustomDirectives).toBe('function');
      expect(typeof mod.resetPlugins).toBe('function');
    });
  });
});
