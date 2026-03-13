import { describe, expect, it } from 'bun:test';
import { html } from '../src/component/index';
import { storyHtml, when } from '../src/storybook/index';

describe('storybook/storyHtml', () => {
  it('creates HTML strings from template literals', () => {
    expect(storyHtml`<bq-button>Save</bq-button>`).toBe('<bq-button>Save</bq-button>');
  });

  it('handles boolean attribute shorthand when enabled', () => {
    const result = storyHtml`<bq-button ?disabled=${true}>Save</bq-button>`;

    expect(result).toBe('<bq-button disabled>Save</bq-button>');
  });

  it('omits boolean attributes when disabled', () => {
    const result = storyHtml`<bq-button ?disabled=${false}>Save</bq-button>`;

    expect(result).toBe('<bq-button>Save</bq-button>');
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
});
