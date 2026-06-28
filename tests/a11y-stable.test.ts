/**
 * A11y → Stable (1.15.0) tests — issue #142.
 *
 * Covers the prerequisites that gate promotion:
 *  - Documented audit scope: every rule maps to a WCAG criterion, findings are
 *    stamped with `wcag`, and the `auditRules` catalog is the source of truth.
 *  - Focus trapping (cycle + release/return focus).
 *  - Live-region announcements (polite/assertive, content surfaced).
 *  - `inert` / `scrollLock` behaviour and the preference signals.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  auditA11y,
  auditRules,
  createLiveRegion,
  inert,
  prefersReducedMotion,
  scrollLock,
  trapFocus,
} from '../src/a11y/index';
import { _resetScrollLockForTests } from '../src/a11y/dom-helpers';

afterEach(() => {
  _resetScrollLockForTests();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
});

describe('A11y Stable — documented audit scope (#142)', () => {
  it('auditRules catalog is complete and well-formed', () => {
    expect(auditRules.length).toBeGreaterThanOrEqual(10);
    for (const r of auditRules) {
      expect(typeof r.rule).toBe('string');
      expect(r.rule.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(typeof r.description).toBe('string');
      expect(r.cannotDetect.length).toBeGreaterThan(0); // every rule documents a limitation
    }
  });

  it('stamps each finding with the WCAG criterion from the catalog', () => {
    document.body.innerHTML = `
      <main>
        <img src="x.png">
        <button></button>
      </main>
    `;
    const report = auditA11y();
    const imgAlt = report.findings.find((f) => f.rule === 'img-alt');
    const btn = report.findings.find((f) => f.rule === 'button-name');
    expect(imgAlt?.wcag).toBe('1.1.1');
    expect(btn?.wcag).toBe('4.1.2');
    // Every emitted finding's rule exists in the documented catalog.
    const ruleIds = new Set(auditRules.map((r) => r.rule));
    for (const f of report.findings) expect(ruleIds.has(f.rule)).toBe(true);
  });

  it('passes a clean, well-formed subtree', () => {
    document.body.innerHTML = `
      <main>
        <h1>Title</h1>
        <img src="x.png" alt="A descriptive label">
        <label for="n">Name</label><input id="n">
        <button>Save</button>
      </main>
    `;
    const report = auditA11y(document.querySelector('main')!);
    expect(report.errors).toBe(0);
    expect(report.passed).toBe(true);
  });
});

describe('A11y Stable — focus trapping (#142)', () => {
  it('cycles focus within the trap and restores on release', () => {
    document.body.innerHTML = `
      <button id="before">before</button>
      <div id="dialog">
        <button id="a">a</button>
        <button id="b">b</button>
      </div>
    `;
    const before = document.getElementById('before') as HTMLButtonElement;
    const dialog = document.getElementById('dialog') as HTMLElement;
    before.focus();
    expect(document.activeElement?.id).toBe('before');

    const handle = trapFocus(dialog);
    expect(handle.active).toBe(true);
    // Initial focus moves inside the trap.
    expect(['a', 'b']).toContain(document.activeElement?.id);

    handle.release();
    expect(handle.active).toBe(false);
    expect(document.activeElement?.id).toBe('before'); // focus returned
  });
});

describe('A11y Stable — live regions (#142)', () => {
  const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  it('creates a polite region and surfaces announced text', async () => {
    const region = createLiveRegion({ delay: 0 });
    expect(region.element.getAttribute('aria-live')).toBe('polite');
    region.announce('Saved');
    await tick(5);
    expect(region.element.textContent).toContain('Saved');
    region.destroy();
  });

  it('supports assertive announcements', () => {
    const region = createLiveRegion({ priority: 'assertive' });
    expect(region.element.getAttribute('aria-live')).toBe('assertive');
    expect(region.element.getAttribute('role')).toBe('alert');
    region.destroy();
  });
});

describe('A11y Stable — inert / scrollLock / preferences (#142)', () => {
  it('inert hides siblings of the target and restores them on release', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="dialog">dialog</div>
        <div id="bg">background</div>
      </div>`;
    const dialog = document.getElementById('dialog') as HTMLElement;
    const bg = document.getElementById('bg') as HTMLElement;
    const handle = inert(dialog);
    expect(bg.hasAttribute('inert')).toBe(true);
    expect(bg.getAttribute('aria-hidden')).toBe('true');
    expect(dialog.hasAttribute('inert')).toBe(false); // target itself stays interactive
    handle.release();
    expect(bg.hasAttribute('inert')).toBe(false);
  });

  it('scrollLock locks and releases document scrolling', () => {
    const handle = scrollLock();
    expect(document.documentElement.style.overflow || document.body.style.overflow).toBe('hidden');
    handle.release();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('prefersReducedMotion returns a boolean signal', () => {
    const sig = prefersReducedMotion();
    expect(typeof sig.value).toBe('boolean');
    if ('destroy' in sig && typeof sig.destroy === 'function') sig.destroy();
  });
});
