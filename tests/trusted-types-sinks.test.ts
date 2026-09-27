/**
 * Trusted Types enforcement for sinks that write already-prepared markup
 * (component render output, author templates) — #253.
 *
 * happy-dom has no Trusted Types, so enforcement is emulated: a mock
 * `window.trustedTypes` brands policy output, and the `innerHTML` setters
 * reject plain strings the way a browser does under
 * `require-trusted-types-for 'script'`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { component, html } from '../src/component/index';
import {
  __resetTrustedTypesPolicy,
  trustedHtmlForSink,
  trustedPreparedHtmlForSink,
} from '../src/security/trusted-types';
import { createTemplate } from '../src/view/index';

type Branded = { __brand: 'TrustedHTML'; toString(): string };

const win = window as unknown as { trustedTypes?: unknown };
const patched: Array<{ proto: object; descriptor: PropertyDescriptor }> = [];
let originalTrustedTypes: unknown;
let policyCalls: string[];

const enforce = (proto: object): void => {
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  if (!descriptor?.set) throw new Error('innerHTML setter not found');
  patched.push({ proto, descriptor });
  Object.defineProperty(proto, 'innerHTML', {
    ...descriptor,
    set(value: unknown) {
      if ((value as Branded | null)?.__brand !== 'TrustedHTML') {
        throw new TypeError("This document requires 'TrustedHTML' assignment.");
      }
      descriptor.set!.call(this, String(value));
    },
  });
};

beforeEach(() => {
  originalTrustedTypes = win.trustedTypes;
  policyCalls = [];
  win.trustedTypes = {
    createPolicy: (_name: string, rules: { createHTML: (input: string) => string }) => ({
      createHTML: (input: string): Branded => {
        const out = rules.createHTML(input);
        policyCalls.push(out);
        return { __brand: 'TrustedHTML', toString: () => out };
      },
    }),
  };
  __resetTrustedTypesPolicy();
  enforce((window as unknown as { Element: { prototype: object } }).Element.prototype);
  enforce((window as unknown as { ShadowRoot: { prototype: object } }).ShadowRoot.prototype);
});

afterEach(() => {
  for (const { proto, descriptor } of patched.splice(0)) {
    Object.defineProperty(proto, 'innerHTML', descriptor);
  }
  if (originalTrustedTypes === undefined) delete win.trustedTypes;
  else win.trustedTypes = originalTrustedTypes;
  __resetTrustedTypesPolicy();
});

describe('Trusted Types enforcement (#253)', () => {
  it('renders components without throwing and keeps component-only markup', () => {
    const errors: unknown[] = [];
    component('x-tt-probe', {
      props: {},
      render: () => html`<div part="box"><slot></slot></div>`,
      onError: (error: unknown) => errors.push(error),
    } as never);

    const el = document.createElement('x-tt-probe');
    document.body.appendChild(el);
    try {
      const root = el.shadowRoot ?? el;
      expect(errors).toEqual([]);
      // Not re-sanitized with the default allow list: <slot> and part survive.
      expect(root.querySelector('slot')).not.toBeNull();
      expect(root.querySelector('[part="box"]')).not.toBeNull();
      expect(policyCalls.length).toBeGreaterThan(0);
    } finally {
      el.remove();
    }
  });

  it('lets createTemplate() parse author templates', () => {
    const render = createTemplate('<p bq-text="message"></p>');
    const view = render({ message: 'hi' });
    expect(view.el.textContent).toBe('hi');
    view.destroy();
  });

  it('only passes through the exact prepared string, and only during the call', () => {
    const prepared = '<slot></slot>';
    expect(String(trustedPreparedHtmlForSink(prepared))).toBe(prepared);

    // The same string sent through the sanitizing entry point afterwards is
    // sanitized normally — the pass-through does not stay armed.
    const unsafe = '<img src=x onerror=alert(1)>';
    trustedPreparedHtmlForSink('<b>other</b>');
    expect(String(trustedHtmlForSink(unsafe))).not.toContain('onerror');
  });
});
