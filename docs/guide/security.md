# Security

bQuery sanitizes DOM writes by default and supports Trusted Types. Use the security module directly when you need explicit control over sanitization and CSP helpers.

As of 1.3.0, the security module is internally modularized (sanitize core, Trusted Types, CSP helpers, and constants). Import from `@bquery/bquery/security` for the stable public API surface.

```ts
import {
  createTrustedHtml,
  escapeHtml,
  generateNonce,
  getTrustedTypesPolicy,
  hasCSPDirective,
  isTrustedTypesSupported,
  sanitize,
  sanitizeHtml,
  stripTags,
  trusted,
} from '@bquery/bquery/security';
```

---

## Sanitization

### `sanitizeHtml()` / `sanitize()`

Sanitizes an HTML string by removing dangerous elements, attributes, and protocols. Returns a branded `SanitizedHtml` type to indicate the string has been processed.

`sanitize` and `sanitizeHtml` are aliases — they refer to the same function.

```ts
function sanitizeHtml(
  html: string,
  options?: SanitizeOptions
): SanitizedHtml;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `html` | `string` | The HTML string to sanitize |
| `options` | `SanitizeOptions` | Optional configuration (see below) |

#### `SanitizeOptions`

```ts
interface SanitizeOptions {
  /** Additional tags to allow beyond the default safe set. */
  allowTags?: string[];
  /** Additional attributes to allow beyond the default safe set. */
  allowAttributes?: string[];
  /** Whether to allow `data-*` attributes. Default: `true` */
  allowDataAttributes?: boolean;
  /** Strip all tags and return plain text. Default: `false` */
  stripAllTags?: boolean;
}
```

#### `SanitizedHtml`

```ts
type SanitizedHtml = string & { readonly [sanitizedHtmlBrand]: true };
```

A branded string type that indicates the value was produced by `sanitizeHtml()`.

#### Examples

**Basic sanitization:**

```ts
const safe = sanitizeHtml('<div onclick="alert(1)">Hello</div>');
// Result: '<div>Hello</div>'
```

**Script removal:**

```ts
const safe = sanitizeHtml('<p>Hi</p><script>alert("xss")</script>');
// Result: '<p>Hi</p>'
```

**Allow custom elements:**

```ts
const safe = sanitizeHtml('<x-icon data-name="ok"></x-icon>', {
  allowTags: ['x-icon'],
  allowAttributes: ['data-name'],
});
// Result: '<x-icon data-name="ok"></x-icon>'
```

**Strip all tags:**

```ts
const text = sanitizeHtml('<p>Hello <strong>world</strong></p>', {
  stripAllTags: true,
});
// Result: 'Hello world'
```

### What Gets Removed

#### Dangerous Elements

The following elements are removed by default. Tags listed in `DANGEROUS_TAGS` are blocked even if you try to allowlist them. `slot` is **not** in that hard block list: it is disallowed by default, but can be explicitly allowlisted for component/shadow-DOM use cases.

| Category | Elements |
|----------|----------|
| Scripts & styles | `script`, `style`, `noscript` |
| Frames | `iframe`, `frame`, `frameset` |
| Embedded objects | `object`, `embed`, `applet` |
| Parsing vectors | `svg`, `math`, `foreignobject` |
| Template slots | `template` (`slot` is disallowed by default, but can be allowlisted) |
| Document metadata | `base`, `meta`, `link` |

#### Dangerous Attributes

| Pattern | Examples |
|---------|----------|
| Event handlers | `onclick`, `onload`, `onerror`, etc. |
| Form actions | `formaction` |
| XML namespaces | `xlink:*`, `xmlns:*` |

#### Dangerous URL Protocols

URLs in `href`, `src`, `action`, and `srcset` are validated. These protocols are blocked:

- `javascript:`
- `data:`
- `vbscript:`
- `file:`

### DOM Clobbering Protection

Reserved IDs and names are stripped to prevent DOM clobbering attacks:

```ts
// The id attribute is stripped because 'cookie' is reserved
sanitizeHtml('<form id="cookie">...</form>');
```

Reserved names include: `document`, `window`, `location`, `navigator`, `cookie`, `domain`, `referrer`, `body`, `head`, `forms`, `images`, `links`, `scripts`, `children`, `parentNode`, `firstChild`, `lastChild`, `innerHTML`, `outerHTML`, `textContent`.

### Srcset Validation

Each URL in `srcset` attributes is validated individually. If **any** entry contains an unsafe URL, the entire `srcset` attribute is removed:

```ts
sanitizeHtml('<img srcset="safe.jpg 1x, javascript:alert(1) 2x">');
// Result: <img>  (entire srcset removed)
```

### Form Action Validation

The `action` attribute on `<form>` elements is validated as a URL attribute:

```ts
sanitizeHtml('<form action="javascript:alert(1)">...</form>');
// Result: <form>...</form>  (action removed)
```

### Unicode Bypass Protection

Zero-width Unicode characters are stripped from URLs to prevent bypass attacks:

```ts
sanitizeHtml('<a href="java\u200Bscript:alert(1)">click</a>');
// Result: <a>click</a>  (href removed)
```

### Automatic Link Security

bQuery automatically adds `rel="noopener noreferrer"` to links that:

1. Have `target="_blank"` (open in new window/tab)
2. Point to external domains (different origin)

```ts
// target="_blank" gets security attributes
sanitizeHtml('<a href="/page" target="_blank">Link</a>');
// Result: <a href="/page" target="_blank" rel="noopener noreferrer">Link</a>

// External links get security attributes automatically
sanitizeHtml('<a href="https://external.com">Link</a>');
// Result: <a href="https://external.com" rel="noopener noreferrer">Link</a>

// Existing rel values are preserved
sanitizeHtml('<a href="https://external.com" rel="author">Link</a>');
// Result: <a href="https://external.com" rel="author noopener noreferrer">Link</a>

// Internal links without target="_blank" are unchanged
sanitizeHtml('<a href="/internal">Link</a>');
// Result: <a href="/internal">Link</a>
```

---

## HTML Escaping

### `escapeHtml()`

Converts text into safe HTML entities. Use this when you need to display user text as content without interpreting it as markup.

```ts
function escapeHtml(text: string): string;
```

```ts
escapeHtml('<script>alert(1)</script>');
// '&lt;script&gt;alert(1)&lt;/script&gt;'

escapeHtml('"Hello" & \'World\'');
// '&quot;Hello&quot; &amp; &#x27;World&#x27;'

escapeHtml('Normal text');
// 'Normal text'
```

---

## Tag Stripping

### `stripTags()`

Removes all HTML tags and returns plain text content.

```ts
function stripTags(html: string): string;
```

```ts
stripTags('<p>Hello <strong>World</strong></p>');
// 'Hello World'

stripTags('<div><ul><li>Item 1</li><li>Item 2</li></ul></div>');
// 'Item 1Item 2'
```

---

## Trusted Fragment Composition

### `trusted()`

Marks a sanitized HTML string for verbatim splicing into `safeHtml` templates. The fragment is inserted as-is without being escaped again.

```ts
function trusted(html: SanitizedHtml): TrustedHtml;
```

#### `TrustedHtml`

```ts
type TrustedHtml = {
  readonly [trustedHtmlBrand]: true;
  toString(): string;
};
```

This is especially useful for component templates and Storybook stories where some fragments are framework-authored and already sanitized, while user data should still be escaped.

```ts
import { safeHtml } from '@bquery/bquery/component';
import { sanitizeHtml, trusted } from '@bquery/bquery/security';

const badge = trusted(sanitizeHtml('<span class="icon">♥</span>'));
const markup = safeHtml`<button>${badge}<span>Save</span></button>`;
// The badge HTML is inserted verbatim, while other interpolations are escaped
```

**Without `trusted()`:**

```ts
// This would DOUBLE-escape the badge HTML
const markup = safeHtml`<button>${'<span class="icon">♥</span>'}<span>Save</span></button>`;
// Result: &lt;span class=&quot;icon&quot;&gt;♥&lt;/span&gt;<span>Save</span>
```

---

## Trusted Types & CSP

These helpers integrate with the browser's [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) for sites that enforce Trusted Types via Content Security Policy.

### `isTrustedTypesSupported()`

Checks if the Trusted Types API is available in the current environment.

```ts
function isTrustedTypesSupported(): boolean;
```

```ts
if (isTrustedTypesSupported()) {
  console.log('Trusted Types are available');
}
```

### `getTrustedTypesPolicy()`

Gets or creates the bQuery Trusted Types policy (named `'bquery-sanitizer'`).

```ts
function getTrustedTypesPolicy(): TrustedTypePolicy | null;
```

```ts
const policy = getTrustedTypesPolicy();
if (policy) {
  const html = policy.createHTML('<div>Safe</div>');
  element.innerHTML = html as unknown as string;
}
```

### `createTrustedHtml()`

Creates a Trusted HTML value that passes Trusted Types enforcement. Falls back to sanitized string output when Trusted Types are not available.

```ts
function createTrustedHtml(html: string): TrustedHTML | string;
```

```ts
const trusted = createTrustedHtml('<div>Safe content</div>');
element.innerHTML = trusted.toString();
```

### `generateNonce()`

Generates a cryptographically random nonce for inline scripts and styles (CSP compliance).

```ts
function generateNonce(length?: number): string;
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `length` | `number` | `16` | Nonce length in bytes (max: 1024) |

**Throws:** `RangeError` if length is less than 1, non-integer, or exceeds 1024.  
**Throws:** `Error` if `crypto.getRandomValues` or `btoa` are unavailable.

```ts
const nonce = generateNonce();
// URL-safe Base64 (base64url) string without padding, e.g., 'dGhpcy1pc19hLXRlc3Q'

const longNonce = generateNonce(32);
```

### `hasCSPDirective()`

Checks if a specific CSP directive appears to be enforced. Useful for feature detection.

```ts
function hasCSPDirective(directive: string): boolean;
```

```ts
if (hasCSPDirective('require-trusted-types-for')) {
  const trusted = createTrustedHtml('<strong>Safe</strong>');
  element.innerHTML = trusted.toString();
} else {
  element.innerHTML = sanitizeHtml('<strong>Safe</strong>');
}
```

---

## Type Definitions

### `TrustedTypePolicy`

```ts
interface TrustedTypePolicy {
  createHTML: (input: string) => TrustedHTML;
}
```

### `TrustedHTML`

```ts
interface TrustedHTML {
  toString(): string;
}
```

---

## Full Example

```ts
import {
  sanitizeHtml,
  escapeHtml,
  stripTags,
  trusted,
  createTrustedHtml,
  generateNonce,
  hasCSPDirective,
  isTrustedTypesSupported,
} from '@bquery/bquery/security';
import { safeHtml } from '@bquery/bquery/component';

// 1. Sanitize user input
const userHtml = '<div onclick="steal()">Hello <b>World</b></div>';
const safe = sanitizeHtml(userHtml);
// '<div>Hello <b>World</b></div>'

// 2. Escape text for display
const userText = '<script>alert("xss")</script>';
const escaped = escapeHtml(userText);
// '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

// 3. Strip to plain text
const plain = stripTags('<p>Hello <em>World</em></p>');
// 'Hello World'

// 4. Compose trusted fragments
const badge = trusted(sanitizeHtml('<span class="badge">New</span>'));
const template = safeHtml`<button>${badge} Save</button>`;

// 5. CSP and Trusted Types integration
if (isTrustedTypesSupported()) {
  const trustedHtml = createTrustedHtml('<div>Content</div>');
  document.getElementById('content')!.innerHTML = trustedHtml.toString();
}

// 6. Generate nonce for inline scripts
const nonce = generateNonce();
const script = document.createElement('script');
script.nonce = nonce;
script.textContent = 'console.log("safe inline script")';
document.head.appendChild(script);
```

---

## Notes

- `sanitizeHtml()` uses DOMParser internally for reliable parsing.
- bQuery's standard core HTML-writing methods sanitize untrusted content by default with `sanitizeHtml()`. Explicit escape hatches such as `htmlUnsafe()` and other raw DOM writes bypass sanitization, so use them only with content you already trust.
- The sanitizer handles nested and recursive attack vectors.
- `trusted()` should only be used with values you have already sanitized — never with raw user input.
- The default allowed tag set includes a broad set of safe HTML elements.
- `generateNonce()` requires a secure context (`crypto.getRandomValues`).
