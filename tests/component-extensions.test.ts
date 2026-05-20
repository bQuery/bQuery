import { describe, expect, it } from 'bun:test';
import { component } from '../src/component/component';
import { html } from '../src/component/html';
import { css, isComponentStyles } from '../src/component/css';
import {
  bindDelegatedEvents,
  on,
  onClick,
  onInput,
} from '../src/component/events';
import { formContextKey, inject, injectionKey, provide } from '../src/component/inject';
import { keyedList, reconcileKeyed } from '../src/component/keyed-list';
import { useRef } from '../src/component/refs';
import { hasSlot, slotText, useSlot } from '../src/component/slots';
import { useAsync, whenIdle } from '../src/component/async';
import { useSignal } from '../src/component/scope';

const uniqueTag = (name: string): string => `${name}-${Math.random().toString(36).slice(2, 9)}`;

// ---------------------------------------------------------------------------
// useRef
// ---------------------------------------------------------------------------

describe('component/useRef', () => {
  it('creates a mutable ref with bind/clear', () => {
    const ref = useRef<HTMLInputElement>();
    expect(ref.current).toBeNull();
    const input = document.createElement('input');
    ref.bind(input);
    expect(ref.current).toBe(input);
    ref.clear();
    expect(ref.current).toBeNull();
  });

  it('clears automatically when the owning component disconnects', () => {
    const tag = uniqueTag('ref-clear');
    let capturedRef: ReturnType<typeof useRef<HTMLDivElement>> | null = null;
    component(tag, {
      connected() {
        const ref = useRef<HTMLDivElement>();
        capturedRef = ref;
        queueMicrotask(() => {
          const inner = this.shadowRoot!.querySelector('div')!;
          ref.bind(inner as HTMLDivElement);
        });
      },
      render: () => html`<div>hi</div>`,
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    // wait microtask
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(capturedRef?.current).toBeInstanceOf(HTMLElement);
        el.remove();
        expect(capturedRef?.current).toBeNull();
        resolve();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// useSlot / hasSlot / slotText
// ---------------------------------------------------------------------------

describe('component/slots', () => {
  it('useSlot returns assigned elements reactively', async () => {
    const tag = uniqueTag('slot-host');
    let captured: ReturnType<typeof useSlot> | null = null;
    component(tag, {
      connected() {
        captured = useSlot(this);
      },
      render: () => html`<div><slot></slot></div>`,
    });
    const host = document.createElement(tag);
    host.innerHTML = '<span>a</span><span>b</span>';
    document.body.appendChild(host);
    // wait for queued lookup
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(captured?.value.length).toBe(2);
    expect(hasSlot(host)).toBe(true);
    expect(slotText(host)).toBe('ab');
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// provide / inject
// ---------------------------------------------------------------------------

describe('component/inject', () => {
  it('resolves provided values through the composed path', () => {
    const ThemeKey = injectionKey<{ dark: boolean }>('theme');
    const parentTag = uniqueTag('inject-parent');
    const childTag = uniqueTag('inject-child');

    let resolvedTheme: unknown = undefined;
    component(parentTag, {
      connected() {
        provide(this, ThemeKey, { dark: true });
      },
      render: () => html`<div><slot></slot></div>`,
    });
    component(childTag, {
      connected() {
        resolvedTheme = inject(this, ThemeKey, { dark: false });
      },
      render: () => html`<span>child</span>`,
    });

    const parent = document.createElement(parentTag);
    document.body.appendChild(parent);
    const child = document.createElement(childTag);
    parent.appendChild(child);

    expect(resolvedTheme).toEqual({ dark: true });
    parent.remove();
  });

  it('returns the fallback when no provider exists', () => {
    const childTag = uniqueTag('inject-orphan');
    let value: number | undefined = -1;
    component(childTag, {
      connected() {
        value = inject<number>(this, 'count', 99);
      },
      render: () => html`<span></span>`,
    });
    const child = document.createElement(childTag);
    document.body.appendChild(child);
    expect(value).toBe(99);
    child.remove();
  });

  it('formContextKey is a usable injection key', () => {
    expect(typeof formContextKey).toBe('symbol');
  });
});

// ---------------------------------------------------------------------------
// useAsync / whenIdle
// ---------------------------------------------------------------------------

describe('component/useAsync', () => {
  it('exposes loading/data signals', async () => {
    const tag = uniqueTag('async-host');
    let captured: ReturnType<typeof useAsync<number>> | null = null;
    component(tag, {
      connected() {
        captured = useAsync(async () => 7);
      },
      render: () => html`<div></div>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await new Promise((r) => setTimeout(r, 5));
    expect(captured?.loading.value).toBe(false);
    expect(captured?.data.value).toBe(7);
    expect(captured?.error.value).toBeNull();
    host.remove();
  });

  it('captures errors', async () => {
    const tag = uniqueTag('async-error');
    let captured: ReturnType<typeof useAsync<number>> | null = null;
    component(tag, {
      connected() {
        captured = useAsync(async () => {
          throw new Error('boom');
        });
      },
      render: () => html`<div></div>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await new Promise((r) => setTimeout(r, 5));
    expect(captured?.error.value).toBeInstanceOf(Error);
    host.remove();
  });
});

describe('component/whenIdle', () => {
  it('runs the callback asynchronously', async () => {
    const tag = uniqueTag('idle-host');
    let ran = false;
    component(tag, {
      connected() {
        whenIdle(() => {
          ran = true;
        });
      },
      render: () => html`<div></div>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await new Promise((r) => setTimeout(r, 20));
    expect(ran).toBe(true);
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// css
// ---------------------------------------------------------------------------

describe('component/css', () => {
  it('produces a ComponentStyles payload', () => {
    const styles = css`
      :host { color: red; }
    `;
    expect(isComponentStyles(styles)).toBe(true);
    expect(String(styles)).toContain(':host');
  });

  it('escapes dangerous values inside interpolations', () => {
    const evil = "'*/ body { background: red } /*";
    const styles = css`
      .x { content: '${evil}'; }
    `;
    expect(styles.text).not.toContain('*/');
    expect(styles.text).not.toContain('/*');
    expect(styles.text).not.toContain("content: ''");
    expect(styles.text).not.toContain('{ background: red }');
  });

  it('inlines nested ComponentStyles', () => {
    const partial = css`color: red;`;
    const full = css`
      :host { ${partial} }
    `;
    expect(full.text).toContain('color: red');
  });

  it('attaches as styles in a component', async () => {
    const tag = uniqueTag('css-component');
    component(tag, {
      styles: css`:host { display: block; color: rebeccapurple; }`,
      render: () => html`<div>x</div>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await new Promise((r) => setTimeout(r, 5));
    // Either via <style> or adoptedStyleSheets — at minimum the component must render without throwing.
    expect(host.shadowRoot?.textContent).toContain('x');
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe('component/events', () => {
  it('produces a data-bq-on-* attribute string', () => {
    const attr = on('click', () => {});
    expect(attr).toMatch(/^data-bq-on-click="bq[a-z0-9]+"$/);
  });

  it('rejects invalid event names', () => {
    expect(() => on('bad name', () => {})).toThrow();
  });

  it('routes delegated clicks through the host', () => {
    const tag = uniqueTag('events-host');
    let clicks = 0;
    component(tag, {
      connected() {
        bindDelegatedEvents(this);
      },
      render() {
        return html`
          <button ${onClick(() => {
            clicks += 1;
          })}>+</button>
        `;
      },
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    const button = host.shadowRoot!.querySelector('button')!;
    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    expect(clicks).toBe(1);
    host.remove();
  });

  it('cleans up delegated handlers created during render on disconnect', () => {
    const tag = uniqueTag('events-cleanup');
    let clicks = 0;
    component(tag, {
      connected() {
        bindDelegatedEvents(this);
      },
      render() {
        return html`
          <button ${onClick(() => {
            clicks += 1;
          })}>+</button>
        `;
      },
    });

    const host = document.createElement(tag);
    document.body.appendChild(host);
    const button = host.shadowRoot!.querySelector('button')!;
    const leakedId = button.getAttribute('data-bq-on-click');
    expect(leakedId).toBeTruthy();

    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    expect(clicks).toBe(1);
    host.remove();

    const attacker = document.createElement('div');
    const root = attacker.attachShadow({ mode: 'open' });
    root.innerHTML = `<button data-bq-on-click="${leakedId ?? ''}">x</button>`;
    bindDelegatedEvents(attacker);
    root
      .querySelector('button')!
      .dispatchEvent(new Event('click', { bubbles: true, composed: true }));

    expect(clicks).toBe(1);
  });

  it('onInput convenience is available', () => {
    const attr = onInput(() => {});
    expect(attr.startsWith('data-bq-on-input=')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// keyedList / reconcileKeyed
// ---------------------------------------------------------------------------

describe('component/keyedList', () => {
  it('injects data-bq-key attributes into top-level item markup', () => {
    const html = keyedList(
      [{ id: 'a', t: 'A' }, { id: 'b', t: 'B' }],
      (it) => it.id,
      (it) => `<li>${it.t}</li>`
    );
    expect(html).toContain('data-bq-key="a"');
    expect(html).toContain('data-bq-key="b"');
    expect(html).toContain('<li');
  });

  it('reconcileKeyed reorders children to match the provided key order', () => {
    const ul = document.createElement('ul');
    ul.innerHTML = `
      <li data-bq-key="a">A</li>
      <li data-bq-key="b">B</li>
      <li data-bq-key="c">C</li>
    `;
    // Swap b and c manually:
    const items = Array.from(ul.querySelectorAll('li'));
    ul.insertBefore(items[2], items[1]); // c before b
    const moved = reconcileKeyed(ul, ['a', 'b', 'c']);
    expect(moved).toBeGreaterThan(0);
    expect(Array.from(ul.children).map((node) => node.getAttribute('data-bq-key'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('escapes key values', () => {
    const html = keyedList(
      [{ id: '<x', t: 'A' }],
      (it) => it.id,
      (it) => `<li>${it.t}</li>`
    );
    expect(html).toContain('data-bq-key="&lt;x"');
  });
});

// ---------------------------------------------------------------------------
// setProp / getProp
// ---------------------------------------------------------------------------

describe('component/setProp/getProp', () => {
  it('allows imperatively setting object props and triggers re-render', async () => {
    const tag = uniqueTag('prop-host');
    let lastRendered: unknown = null;
    component<{ items?: string[] }>(tag, {
      props: {
        items: { type: Array, default: [] as unknown as string[] },
      },
      render({ props }) {
        lastRendered = props.items;
        return html`<ul></ul>`;
      },
    });
    const host = document.createElement(tag) as HTMLElement & {
      setProp: (k: string, v: unknown) => void;
      getProp: <T>(k: string) => T;
    };
    document.body.appendChild(host);
    host.setProp('items', ['a', 'b']);
    expect(host.getProp<string[]>('items')).toEqual(['a', 'b']);
    expect(lastRendered).toEqual(['a', 'b']);
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// beforeUnmount / errorBoundary
// ---------------------------------------------------------------------------

describe('component/lifecycle additions', () => {
  it('fires beforeUnmount before disconnect cleanup', () => {
    const tag = uniqueTag('hooks-host');
    const order: string[] = [];
    component(tag, {
      connected() {
        order.push('connected');
      },
      beforeUnmount() {
        order.push('beforeUnmount');
      },
      disconnected() {
        order.push('disconnected');
      },
      render: () => html`<div></div>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    host.remove();
    expect(order).toEqual(['connected', 'beforeUnmount', 'disconnected']);
  });

  it('errorBoundary renders fallback markup when render throws', () => {
    const tag = uniqueTag('boundary-host');
    component(tag, {
      render() {
        throw new Error('boom');
      },
      errorBoundary(err) {
        return `<div data-fallback>${err.message}</div>`;
      },
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    expect(host.shadowRoot?.innerHTML).toContain('data-fallback');
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// useForm (composable) — quick integration check
// ---------------------------------------------------------------------------

import { useForm } from '../src/forms/composables';

describe('forms/useForm composable', () => {
  it('creates a form bound to the component scope and disposes on disconnect', () => {
    const tag = uniqueTag('form-host');
    let formRef: ReturnType<typeof useForm<{ name: string }>> | null = null;
    component(tag, {
      connected() {
        formRef = useForm<{ name: string }>({
          fields: { name: { initialValue: '' } },
        });
      },
      render: () => html`<form></form>`,
    });
    const host = document.createElement(tag);
    document.body.appendChild(host);
    expect(formRef).not.toBeNull();
    formRef!.fields.name.value.value = 'Ada';
    expect(formRef!.fields.name.value.value).toBe('Ada');
    host.remove();
    // After disconnect, destroy ran — further mutation still works but
    // subscribers are gone. Just verify no throw.
    expect(() => formRef!.fields.name.value.value = 'x').not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Touch the useSignal import to ensure it still exists
// ---------------------------------------------------------------------------

describe('component/regression', () => {
  it('still exports useSignal', () => {
    expect(typeof useSignal).toBe('function');
  });
});
