/**
 * View 1.14.0 expansion tests — strictly additive surface.
 */

import { describe, expect, it, spyOn } from 'bun:test';
import { computed, signal } from '../src/reactive/index';
import { mount, parseDirective } from '../src/view/index';

describe('View 1.14.0 expansion', () => {
  describe('parseDirective', () => {
    it('parses a bare directive', () => {
      const parsed = parseDirective('text');
      expect(parsed.directive).toBe('text');
      expect(parsed.arg).toBeNull();
      expect(parsed.modifiers.size).toBe(0);
    });

    it('parses directive with argument', () => {
      const parsed = parseDirective('on:click');
      expect(parsed.directive).toBe('on');
      expect(parsed.arg).toBe('click');
    });

    it('parses modifiers without parameters', () => {
      const parsed = parseDirective('on:click.stop.prevent');
      expect(parsed.directive).toBe('on');
      expect(parsed.arg).toBe('click');
      expect(parsed.modifiers.has('stop')).toBe(true);
      expect(parsed.modifiers.has('prevent')).toBe(true);
    });

    it('parses modifiers with parameters', () => {
      const parsed = parseDirective('model.debounce-300.trim');
      expect(parsed.directive).toBe('model');
      expect(parsed.arg).toBeNull();
      expect(parsed.modifiers.has('debounce')).toBe(true);
      expect(parsed.modifiers.has('trim')).toBe(true);
      expect(parsed.modParams.debounce).toBe('300');
    });

    it('handles bind: with arg + modifiers', () => {
      const parsed = parseDirective('bind:href.eager');
      expect(parsed.directive).toBe('bind');
      expect(parsed.arg).toBe('href');
      expect(parsed.modifiers.has('eager')).toBe(true);
    });
  });

  describe('bq-cloak', () => {
    it('removes the bq-cloak attribute after mount', () => {
      const root = document.createElement('div');
      root.setAttribute('bq-cloak', '');
      root.innerHTML = '<span bq-text="msg"></span>';
      document.body.appendChild(root);
      const view = mount(root, { msg: signal('hello') });
      expect(root.hasAttribute('bq-cloak')).toBe(false);
      const span = root.querySelector('span');
      expect(span?.textContent).toBe('hello');
      view.destroy();
      root.remove();
    });
  });

  describe('bq-pre', () => {
    it('skips directive processing in subtree', () => {
      const root = document.createElement('div');
      root.innerHTML = `
        <span bq-text="outer"></span>
        <div bq-pre>
          <span bq-text="inner">literal</span>
        </div>
      `;
      document.body.appendChild(root);
      const view = mount(root, {
        outer: signal('OUTER'),
        inner: signal('INNER'),
      });
      const outerSpan = root.querySelectorAll('span')[0];
      const innerSpan = root.querySelectorAll('span')[1];
      expect(outerSpan.textContent).toBe('OUTER');
      // Inner directive should NOT have been processed.
      expect(innerSpan.textContent).toBe('literal');
      // The bq-pre marker itself is removed.
      expect(root.querySelector('div')?.hasAttribute('bq-pre')).toBe(false);
      // The inner bq-text attribute is preserved (not stripped).
      expect(innerSpan.hasAttribute('bq-text')).toBe(true);
      view.destroy();
      root.remove();
    });

    it('skips processing the root subtree when the mount root has bq-pre', () => {
      const root = document.createElement('div');
      root.setAttribute('bq-pre', '');
      root.innerHTML = '<span bq-text="inner">literal</span>';
      document.body.appendChild(root);
      const view = mount(root, {
        inner: signal('INNER'),
      });
      const innerSpan = root.querySelector('span')!;
      expect(innerSpan.textContent).toBe('literal');
      expect(root.hasAttribute('bq-pre')).toBe(false);
      expect(innerSpan.hasAttribute('bq-text')).toBe(true);
      view.destroy();
      root.remove();
    });

    it('removes bq-cloak before skipping a bq-pre root subtree', () => {
      const root = document.createElement('div');
      root.setAttribute('bq-pre', '');
      root.setAttribute('bq-cloak', '');
      root.innerHTML = '<span bq-text="inner">literal</span>';
      document.body.appendChild(root);
      const view = mount(root, {
        inner: signal('INNER'),
      });
      const innerSpan = root.querySelector('span')!;
      expect(root.hasAttribute('bq-pre')).toBe(false);
      expect(root.hasAttribute('bq-cloak')).toBe(false);
      expect(innerSpan.textContent).toBe('literal');
      expect(innerSpan.hasAttribute('bq-text')).toBe(true);
      view.destroy();
      root.remove();
    });
  });

  describe('bq-once', () => {
    it('evaluates expression once and does not subscribe', () => {
      const root = document.createElement('div');
      root.innerHTML = '<span bq-once="msg"></span>';
      document.body.appendChild(root);
      const msg = signal('first');
      const view = mount(root, { msg });
      const span = root.querySelector('span')!;
      expect(span.textContent).toBe('first');
      msg.value = 'second';
      // Should NOT update.
      expect(span.textContent).toBe('first');
      view.destroy();
      root.remove();
    });
  });

  describe('bq-init', () => {
    it('runs the expression once on mount', () => {
      const root = document.createElement('div');
      root.innerHTML = '<div bq-init="count.value++"></div>';
      document.body.appendChild(root);
      const count = signal(0);
      const view = mount(root, { count });
      expect(count.value).toBe(1);
      view.destroy();
      root.remove();
    });
  });

  describe('bq-html-safe', () => {
    it('sanitizes even when mount sanitize: false', () => {
      const root = document.createElement('div');
      root.innerHTML = '<div bq-html-safe="raw"></div>';
      document.body.appendChild(root);
      const raw = signal('<img src=x onerror="alert(1)">unsafe');
      const view = mount(root, { raw }, { sanitize: false });
      const div = root.querySelector('div')!;
      expect(div.innerHTML).not.toContain('onerror');
      view.destroy();
      root.remove();
    });
  });

  describe('bq-on modifiers', () => {
    it('supports .stop', () => {
      const root = document.createElement('div');
      root.innerHTML = `
        <div id="outer">
          <button id="inner" bq-on:click.stop="onClick">x</button>
        </div>
      `;
      document.body.appendChild(root);
      let outerCalled = 0;
      let innerCalled = 0;
      const outer = root.querySelector('#outer')!;
      outer.addEventListener('click', () => outerCalled++);
      const view = mount(root, {
        onClick: () => innerCalled++,
      });
      (root.querySelector('#inner') as HTMLButtonElement).click();
      expect(innerCalled).toBe(1);
      expect(outerCalled).toBe(0);
      view.destroy();
      root.remove();
    });

    it('supports .prevent', () => {
      const root = document.createElement('div');
      root.innerHTML =
        '<a href="#nope" bq-on:click.prevent="onClick">link</a>';
      document.body.appendChild(root);
      let defaultPrevented = false;
      const view = mount(root, {
        onClick: () => {},
      });
      const a = root.querySelector('a')!;
      a.addEventListener('click', (e) => {
        defaultPrevented = e.defaultPrevented;
      });
      a.click();
      expect(defaultPrevented).toBe(true);
      view.destroy();
      root.remove();
    });

    it('forces passive listeners off when .prevent is present', () => {
      const root = document.createElement('div');
      root.innerHTML =
        '<a href="#nope" bq-on:click.prevent.passive="onClick">link</a>';
      document.body.appendChild(root);
      const view = mount(root, {
        onClick: () => {},
      });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      root.querySelector('a')!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      view.destroy();
      root.remove();
    });

    it('supports .once', () => {
      const root = document.createElement('div');
      root.innerHTML = '<button bq-on:click.once="onClick">x</button>';
      document.body.appendChild(root);
      let calls = 0;
      const view = mount(root, { onClick: () => calls++ });
      const btn = root.querySelector('button')!;
      const removeSpy = spyOn(btn, 'removeEventListener');
      btn.click();
      expect(removeSpy).toHaveBeenCalledTimes(1);
      btn.click();
      btn.click();
      expect(calls).toBe(1);
      removeSpy.mockRestore();
      view.destroy();
      root.remove();
    });

    it('keeps .once listeners armed until modifier filters match', () => {
      const root = document.createElement('div');
      root.innerHTML = '<input bq-on:keydown.enter.once="onEnter" type="text" />';
      document.body.appendChild(root);
      let calls = 0;
      const view = mount(root, { onEnter: () => calls++ });
      const input = root.querySelector('input')!;
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      expect(calls).toBe(1);
      view.destroy();
      root.remove();
    });

    it('supports .self', () => {
      const root = document.createElement('div');
      root.innerHTML = `
        <div id="outer" bq-on:click.self="onClick">
          <button id="inner">x</button>
        </div>
      `;
      document.body.appendChild(root);
      let calls = 0;
      const view = mount(root, { onClick: () => calls++ });
      // Click directly on outer -> fires.
      (root.querySelector('#outer') as HTMLElement).click();
      // Click on inner (bubbles to outer) -> filtered.
      (root.querySelector('#inner') as HTMLElement).click();
      expect(calls).toBe(1);
      view.destroy();
      root.remove();
    });

    it('supports key filters .enter', () => {
      const root = document.createElement('div');
      root.innerHTML =
        '<input bq-on:keydown.enter="onEnter" type="text" />';
      document.body.appendChild(root);
      let calls = 0;
      const view = mount(root, { onEnter: () => calls++ });
      const input = root.querySelector('input')!;
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      expect(calls).toBe(1);
      view.destroy();
      root.remove();
    });

    it('supports system modifier .ctrl', () => {
      const root = document.createElement('div');
      root.innerHTML =
        '<input bq-on:keydown.ctrl.enter="onAction" type="text" />';
      document.body.appendChild(root);
      let calls = 0;
      const view = mount(root, { onAction: () => calls++ });
      const input = root.querySelector('input')!;
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
        })
      );
      expect(calls).toBe(1);
      view.destroy();
      root.remove();
    });
  });

  describe('computed integration', () => {
    it('bq-once captures computed value once', () => {
      const root = document.createElement('div');
      root.innerHTML = '<span bq-once="doubled"></span>';
      document.body.appendChild(root);
      const n = signal(5);
      const doubled = computed(() => n.value * 2);
      const view = mount(root, { n, doubled });
      expect(root.querySelector('span')?.textContent).toBe('10');
      n.value = 50;
      expect(root.querySelector('span')?.textContent).toBe('10');
      view.destroy();
      root.remove();
    });
  });
});
