import { describe, expect, it } from 'bun:test';
import { html } from '../src/component/index';
import { storyHtml, when } from '../src/storybook/index';

describe('storybook/storyHtml', () => {
  it('creates HTML strings from template literals', () => {
    expect(storyHtml`<bq-button>Save</bq-button>`).toBe('<bq-button>Save</bq-button>');
  });

  it('handles boolean attribute shorthand when enabled', () => {
    const result = storyHtml`<bq-button ?disabled=${true}>Save</bq-button>`;

    expect(result).toBe('<bq-button disabled="">Save</bq-button>');
  });

  it('omits boolean attributes when disabled', () => {
    const result = storyHtml`<bq-button ?disabled=${false}>Save</bq-button>`;

    expect(result).toBe('<bq-button>Save</bq-button>');
  });

  it('preserves multiline spacing when omitting boolean attributes', () => {
    const result = storyHtml`<bq-button
      ?disabled=${false}
      variant="primary"
    >Save</bq-button>`;

    expect(result).toContain('<bq-button');
    expect(result).toContain('variant="primary"');
    expect(result).not.toContain('disabled');
  });

  it('preserves normal boolean interpolation outside attribute shorthand', () => {
    const result = storyHtml`<span>${true} ${false}</span>`;

    expect(result).toBe('<span>true false</span>');
  });

  it('supports conditional rendering with when()', () => {
    const enabled = storyHtml`<bq-card>${when(true, () => html`<p>Visible</p>`)}</bq-card>`;
    const disabled = storyHtml`<bq-card>${when(false, () => html`<p>Visible</p>`)}</bq-card>`;

    expect(enabled).toBe('<bq-card><p>Visible</p></bq-card>');
    expect(disabled).toBe('<bq-card></bq-card>');
  });

  it('supports fallback conditional rendering with when()', () => {
    const result = storyHtml`<bq-card>${when(false, () => html`<p>Visible</p>`, 'Hidden')}</bq-card>`;

    expect(result).toBe('<bq-card>Hidden</bq-card>');
  });

  it('supports arrays of fragments', () => {
    const result = storyHtml`<ul>${['<li>One</li>', '<li>Two</li>']}</ul>`;

    expect(result).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('preserves story-authored custom elements and attributes after sanitization', () => {
    const result = storyHtml`<bq-button variant=${'primary'}>Save</bq-button>`;

    expect(result).toContain('<bq-button');
    expect(result).toContain('variant="primary"');
    expect(result).toContain('>Save</bq-button>');
  });

  it('preserves nested custom element tags and authored attributes after sanitization', () => {
    const result = storyHtml`<bq-card data-state=${'open'}><bq-icon aria-label=${'Info'} data-name=${'hero'}></bq-icon></bq-card>`;

    expect(result).toContain('<bq-card');
    expect(result).toContain('data-state="open"');
    expect(result).toContain('<bq-icon');
    expect(result).toContain('aria-label="Info"');
    expect(result).toContain('data-name="hero"');
  });

  it('does not auto-allow inline style attributes in story templates', () => {
    const result = storyHtml`<bq-button style=${'color:red'} variant=${'primary'}>Save</bq-button>`;

    expect(result).toContain('<bq-button');
    expect(result).toContain('variant="primary"');
    expect(result).not.toContain('style=');
  });

  it('does not treat literal attribute values as additional allowlisted attributes', () => {
    const result = storyHtml`<bq-card title="literal foo=bar">${'<span foo="bar">Visible</span>'}</bq-card>`;

    expect(result).toBe('<bq-card title="literal foo=bar"><span>Visible</span></bq-card>');
    expect(result).not.toContain('<span foo=');
  });

  it('does not treat whitespace-padded unquoted literal values as additional allowlisted attributes', () => {
    const result = storyHtml`<bq-card data-token= foo=bar>${'<span foo="bar">Visible</span>'}</bq-card>`;

    expect(result).toContain('<bq-card');
    expect(result).toContain('data-token=');
    expect(result).toContain('<span>Visible</span>');
    expect(result).not.toContain('<span foo=');
  });

  it('sanitizes dangerous interpolated markup', () => {
    const result = storyHtml`<bq-button>${'<img src=x onerror=alert(1)><script>alert(1)</script>'}</bq-button>`;

    expect(result).toContain('<bq-button');
    expect(result).toContain('<img src="x">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<script>');
  });

  it('resolves boolean shorthand from callback values before deciding attribute presence', () => {
    const disabled = storyHtml`<bq-button ?disabled=${() => true}>Save</bq-button>`;
    const enabled = storyHtml`<bq-button ?disabled=${() => false}>Save</bq-button>`;

    expect(disabled).toBe('<bq-button disabled="">Save</bq-button>');
    expect(enabled).toBe('<bq-button>Save</bq-button>');
  });

  it('preserves truthy boolean shorthand semantics for resolved values', () => {
    const numeric = storyHtml`<bq-button ?disabled=${() => 1}>Save</bq-button>`;
    const stringValue = storyHtml`<bq-button ?disabled=${'true'}>Save</bq-button>`;
    const arrayValue = storyHtml`<bq-button ?disabled=${() => ['yes']}>Save</bq-button>`;
    const zeroValue = storyHtml`<bq-button ?disabled=${() => 0}>Save</bq-button>`;

    expect(numeric).toBe('<bq-button disabled="">Save</bq-button>');
    expect(stringValue).toBe('<bq-button disabled="">Save</bq-button>');
    expect(arrayValue).toBe('<bq-button disabled="">Save</bq-button>');
    expect(zeroValue).toBe('<bq-button>Save</bq-button>');
  });
});
