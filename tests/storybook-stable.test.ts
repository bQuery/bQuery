/**
 * Storybook → Stable (1.15.0) tests — issue #148.
 *
 * Pins the frozen helper surface and, crucially, the **security contract**:
 * `storyHtml` sanitizes everything it interpolates via the security module's
 * sanitizer; only `unsafeHtml()`-wrapped, author-controlled fragments are
 * re-inserted verbatim.
 */

import { describe, expect, it } from 'bun:test';
import {
  classMap,
  ifDefined,
  repeat,
  storyHtml,
  storyText,
  styleMap,
  unsafeHtml,
  when,
} from '../src/storybook/index';

describe('Storybook Stable — security contract (#148)', () => {
  it('sanitizes interpolated values by default', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const result = storyHtml`<bq-card>${malicious}</bq-card>`;
    expect(result).not.toContain('onerror');
    expect(result).toContain('<bq-card>');
  });

  it('strips script structure from the template', () => {
    const result = storyHtml`<bq-card><script>alert(1)</script>${'text'}</bq-card>`;
    expect(result).not.toContain('<script>');
    expect(result).toContain('text');
  });

  it('unsafeHtml bypasses sanitization only for the wrapped, trusted fragment', () => {
    const trusted = '<bq-icon name="check"></bq-icon>';
    const malicious = '<script>alert(1)</script>';
    const result = storyHtml`<bq-card>${unsafeHtml(trusted)}${malicious}</bq-card>`;
    expect(result).toContain('<bq-icon name="check"></bq-icon>'); // trusted kept verbatim
    expect(result).not.toContain('<script>'); // surrounding template still sanitized
  });

  it('does not honour objects spoofing the unsafeHtml brand', () => {
    const spoofed = {
      [Symbol.for('bquery.storybook.unsafeHtml')]: true,
      value: '<img src=x onerror=alert(1)>',
    };
    const result = storyHtml`<bq-card>${spoofed as unknown as string}</bq-card>`;
    expect(result).not.toContain('<img');
  });
});

describe('Storybook Stable — frozen helper output (#148)', () => {
  it('classMap joins truthy keys', () => {
    expect(classMap({ active: true, hidden: false, primary: 1 })).toBe('active primary');
  });

  it('styleMap renders a CSS string and drops nullish values', () => {
    const css = styleMap({ color: 'red', width: 10, display: null, margin: undefined });
    expect(css).toContain('color:red');
    expect(css).not.toContain('display');
  });

  it('ifDefined omits nullish but keeps defined values', () => {
    expect(ifDefined('x')).toBe('x');
    expect(ifDefined(undefined)).toBe('');
    expect(ifDefined(null)).toBe('');
  });

  it('repeat renders keyed items and storyText escapes', () => {
    const items = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
    ];
    // render is the 2nd arg, key the 3rd. Plain strings are escaped by design;
    // wrap trusted per-item markup in unsafeHtml (as the helper documents).
    const out = storyHtml`<ul>${repeat(
      items,
      (i) => unsafeHtml(storyHtml`<li>${i.label}</li>`),
      (i) => i.id
    )}</ul>`;
    expect(out).toContain('>A</li>');
    expect(out).toContain('>B</li>');
    expect(out).toContain('data-bq-key');
    expect(storyText('<b>')).not.toContain('<b>'); // escaped, not raw markup
  });

  it('when renders the truthy branch', () => {
    expect(
      when(
        true,
        () => 'yes',
        () => 'no'
      )
    ).toBe('yes');
    expect(
      when(
        false,
        () => 'yes',
        () => 'no'
      )
    ).toBe('no');
  });
});
