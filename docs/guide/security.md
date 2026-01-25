# Security

bQuery sanitizes DOM writes by default and supports Trusted Types. Use the security module directly when you need explicit control over sanitization and CSP helpers.

As of 1.3.0, the security module is internally modularized (sanitize core, Trusted Types, CSP helpers, and constants). The **public API remains unchanged**, so you continue to import from `@bquery/bquery/security` as usual.

For compatibility with legacy deep imports, `@bquery/bquery/security/sanitize` also re-exports `generateNonce()` and `isTrustedTypesSupported()`.

```ts
import { sanitize, escapeHtml, stripTags } from '@bquery/bquery/security';

const safeHtml = sanitize(userInput);
const escaped = escapeHtml('<script>alert(1)</script>');
const textOnly = stripTags('<b>Hello</b>');
```

## Sanitization

`sanitize` and `sanitizeHtml` are aliases.

```ts
import { sanitize } from '@bquery/bquery/security';

const safe = sanitize('<div onclick="alert(1)">Hello</div>');
```

### Dangerous Elements

The following elements are **always removed**:

- `script`, `style`, `iframe`, `frame`, `frameset`
- `object`, `embed`, `applet`
- `svg`, `math` (due to XSS vectors)
- `template`, `slot`
- `base`, `meta`, `link`, `noscript`

### DOM Clobbering Protection

Reserved IDs and names are stripped to prevent DOM clobbering attacks:

- `document`, `window`, `location`, `navigator`
- `cookie`, `domain`, `referrer`
- `body`, `head`, `forms`, `images`, `links`, `scripts`
- `children`, `parentNode`, `firstChild`, `lastChild`
- `innerHTML`, `outerHTML`, `textContent`

```ts
// The id attribute is stripped
sanitize('<form id="cookie">...</form>');
```

### Unicode Bypass Protection

Zero-width Unicode characters are stripped from URLs to prevent bypass attacks:

```ts
// Zero-width characters in "javascript:" are stripped
sanitize('<a href="java\u200Bscript:alert(1)">click</a>');
// Result: <a>click</a>
```

### Automatic Link Security

bQuery automatically adds `rel="noopener noreferrer"` to links that:

1. Have `target="_blank"` attribute (open in new window/tab)
2. Point to external domains (different origin)

This protects against:

- **Tabnabbing attacks**: prevents the opened page from accessing `window.opener`
- **Referrer leakage**: prevents sensitive information in the URL from being sent

```ts
// Links with target="_blank" get security attributes
sanitize('<a href="/page" target="_blank">Link</a>');
// Result: <a href="/page" target="_blank" rel="noopener noreferrer">Link</a>

// External links get security attributes automatically
sanitize('<a href="https://external.com">Link</a>');
// Result: <a href="https://external.com" rel="noopener noreferrer">Link</a>

// Existing rel values are preserved
sanitize('<a href="https://external.com" rel="author">Link</a>');
// Result: <a href="https://external.com" rel="author noopener noreferrer">Link</a>

// Internal links without target="_blank" are unchanged
sanitize('<a href="/internal">Link</a>');
// Result: <a href="/internal">Link</a>
```

### Options

- `allowTags?: string[]`
- `allowAttributes?: string[]`
- `allowDataAttributes?: boolean` (default: true)
- `stripAllTags?: boolean` (default: false)

```ts
const safe = sanitize('<x-icon data-name="ok"></x-icon>', {
  allowTags: ['x-icon'],
  allowAttributes: ['data-name'],
});
```

## Escaping

`escapeHtml` converts text into safe HTML entities.

```ts
const escaped = escapeHtml('<b>bold</b>');
```

## Strip tags

`stripTags` removes all tags and returns plain text.

```ts
const textOnly = stripTags('<p>Hello <em>World</em></p>');
```

## Trusted Types & CSP

- `isTrustedTypesSupported()`
- `getTrustedTypesPolicy()`
- `createTrustedHtml(html)`
- `generateNonce(length?)`
- `hasCSPDirective(directive)`

```ts
import { createTrustedHtml, hasCSPDirective } from '@bquery/bquery/security';

if (hasCSPDirective('require-trusted-types-for')) {
  const trusted = createTrustedHtml('<strong>Safe</strong>');
  element.innerHTML = trusted.toString();
}
```
