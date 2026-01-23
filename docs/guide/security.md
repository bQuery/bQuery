# Security

bQuery sanitizes DOM writes by default and supports Trusted Types. Use the security module directly when you need explicit control over sanitization and CSP helpers.

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
