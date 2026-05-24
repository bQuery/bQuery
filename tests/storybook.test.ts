import { describe, expect, it } from 'bun:test';
import { html } from '../src/component/index';
import {
  classMap,
  ifDefined,
  repeat,
  storyHtml,
  storySvg,
  storyText,
  styleMap,
  unsafeHtml,
  when,
} from '../src/storybook/index';

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

describe('storybook/unsafeHtml', () => {
  it('bypasses sanitization for the wrapped value when interpolated into storyHtml', () => {
    const trusted = '<bq-icon name="check"></bq-icon>';
    const result = storyHtml`<bq-card>${unsafeHtml(trusted)}</bq-card>`;
    expect(result).toBe('<bq-card><bq-icon name="check"></bq-icon></bq-card>');
  });

  it('still sanitizes the surrounding template structure', () => {
    const trusted = '<span class="badge">Stable</span>';
    const malicious = '<script>alert(1)</script>';
    const result = storyHtml`<bq-card>${unsafeHtml(trusted)}${malicious}</bq-card>`;
    expect(result).toContain('<span class="badge">Stable</span>');
    expect(result).not.toContain('<script>');
  });

  it('supports multiple unsafe fragments in the same template', () => {
    const a = unsafeHtml('<i class="a"></i>');
    const b = unsafeHtml('<i class="b"></i>');
    const result = storyHtml`<bq-card>${a}/${b}</bq-card>`;
    expect(result).toBe('<bq-card><i class="a"></i>/<i class="b"></i></bq-card>');
  });
});

describe('storybook/classMap', () => {
  it('joins truthy class names with a space', () => {
    expect(classMap({ primary: true, large: true })).toBe('primary large');
  });

  it('omits falsy entries', () => {
    expect(classMap({ primary: true, disabled: false, hidden: null, loading: 0 })).toBe('primary');
  });

  it('returns an empty string when nothing is enabled', () => {
    expect(classMap({ a: false, b: null })).toBe('');
  });

  it('composes cleanly inside storyHtml class attribute', () => {
    const result = storyHtml`<bq-button class="${classMap({ primary: true, disabled: true })}">Save</bq-button>`;
    expect(result).toContain('class="primary disabled"');
  });
});

describe('storybook/styleMap', () => {
  it('builds a semicolon-delimited declaration list', () => {
    expect(styleMap({ color: 'red', 'background-color': 'blue' })).toBe(
      'color:red;background-color:blue'
    );
  });

  it('converts camelCase property names to hyphen-case', () => {
    expect(styleMap({ backgroundColor: 'red', marginTop: '4px' })).toBe(
      'background-color:red;margin-top:4px'
    );
  });

  it('skips null, undefined, and false values', () => {
    expect(styleMap({ color: 'red', backgroundColor: null, border: undefined, opacity: 0 })).toBe(
      'color:red;opacity:0'
    );
  });
});

describe('storybook/ifDefined', () => {
  it('returns the value as a string when defined', () => {
    expect(ifDefined('hello')).toBe('hello');
    expect(ifDefined(0)).toBe('0');
  });

  it('returns an empty string for null and undefined', () => {
    expect(ifDefined(null)).toBe('');
    expect(ifDefined(undefined)).toBe('');
  });

  it('omits the attribute value cleanly inside storyHtml', () => {
    const defined = storyHtml`<bq-input placeholder="${ifDefined('Type…')}"></bq-input>`;
    const omitted = storyHtml`<bq-input placeholder="${ifDefined(undefined)}"></bq-input>`;
    expect(defined).toContain('placeholder="Type…"');
    expect(omitted).toContain('placeholder=""');
  });
});

describe('storybook/repeat', () => {
  it('renders each item through the render function', () => {
    const items = ['One', 'Two', 'Three'];
    const result = storyHtml`<ul>${repeat(items, (item) => storyHtml`<li>${item}</li>`)}</ul>`;
    expect(result).toBe('<ul><li>One</li><li>Two</li><li>Three</li></ul>');
  });

  it('injects data-bq-key attributes when a key function is provided', () => {
    const items = [
      { id: 'a', label: 'Apple' },
      { id: 'b', label: 'Banana' },
    ];
    const result = storyHtml`<ul>${repeat(
      items,
      (item) => storyHtml`<li>${item.label}</li>`,
      (item) => item.id
    )}</ul>`;
    expect(result).toContain('<li data-bq-key="a">Apple</li>');
    expect(result).toContain('<li data-bq-key="b">Banana</li>');
  });

  it('handles empty lists without errors', () => {
    const result = storyHtml`<ul>${repeat([], (item) => String(item))}</ul>`;
    expect(result).toBe('<ul></ul>');
  });

  it('escapes the key value to prevent attribute injection', () => {
    const items = ['x'];
    const result = storyHtml`<ul>${repeat(
      items,
      (item) => storyHtml`<li>${item}</li>`,
      () => '" onclick="alert(1)'
    )}</ul>`;
    // The dangerous double-quote → attribute-break must be HTML-escaped.
    expect(result).not.toMatch(/data-bq-key="[^"]*" onclick=/);
    expect(result).toContain('&quot;');
  });
});

describe('storybook/storyText', () => {
  it('escapes HTML special characters', () => {
    expect(storyText('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('returns empty string for null and undefined', () => {
    expect(storyText(null)).toBe('');
    expect(storyText(undefined)).toBe('');
  });

  it('coerces numbers to strings', () => {
    expect(storyText(42)).toBe('42');
  });

  it('protects against XSS when interpolated into storyHtml', () => {
    const userInput = '<img src=x onerror=alert(1)>';
    const result = storyHtml`<bq-tooltip>${storyText(userInput)}</bq-tooltip>`;
    // The escaped output renders as inert text — the `<img>` tag never reaches the parser.
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});

describe('storybook/storySvg', () => {
  it('preserves SVG element structure and attributes', () => {
    const result = storySvg`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;
    expect(result).toContain('<svg');
    expect(result).toContain('viewBox="0 0 24 24"');
    expect(result).toContain('<circle');
    expect(result).toContain('r="10"');
  });

  it('escapes interpolated values so user input cannot inject markup', () => {
    const malicious = '"><script>alert(1)</script>';
    const result = storySvg`<svg aria-label="${malicious}"><circle cx="0" cy="0" r="1"/></svg>`;
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('<circle');
  });

  it('preserves ARIA attributes for accessible icons', () => {
    const result = storySvg`<svg role="img" aria-label="Check"><path d="M0 0L10 10"/></svg>`;
    expect(result).toContain('role="img"');
    expect(result).toContain('aria-label="Check"');
  });

  it('interpolates story values into SVG attribute slots', () => {
    const size = 32;
    const color = 'red';
    const result = storySvg`<svg width="${size}" height="${size}"><circle fill="${color}" cx="0" cy="0" r="1"/></svg>`;
    expect(result).toContain('width="32"');
    expect(result).toContain('height="32"');
    expect(result).toContain('fill="red"');
  });

  it('supports unsafeHtml() for splicing pre-built SVG fragments', () => {
    const trustedFragment = '<g class="icon"><path d="M0 0L10 10"/></g>';
    const result = storySvg`<svg viewBox="0 0 24 24">${unsafeHtml(trustedFragment)}</svg>`;
    expect(result).toContain('<g class="icon">');
    expect(result).toContain('<path d="M0 0L10 10"/>');
  });
});

describe('storybook/when with new values', () => {
  // Sanity: storyHtml interactions with the other helpers continue to behave.
  it('combines when + classMap + storyHtml cleanly', () => {
    const isPrimary = true;
    const result = storyHtml`<bq-button class="${classMap({ primary: isPrimary })}">${when(
      isPrimary,
      () => html`<span>Save</span>`,
      'Cancel'
    )}</bq-button>`;
    expect(result).toContain('class="primary"');
    expect(result).toContain('<span>Save</span>');
  });
});
