# Security Model

bQuery.js is **secure by default**. The most common XSS footguns — writing untrusted strings into the DOM — are blocked unless you explicitly opt out. This page summarises the framework's security posture. The full sanitizer API lives in the [Security module](/guide/security).

## Defaults at a glance

- **HTML-writing APIs sanitize.** Any API that assigns to `innerHTML`-equivalent surfaces (templates, view directives, component HTML, story helpers) routes through `sanitizeHtml()`.
- **Attribute interpolation escapes.** Attribute values built from user input are HTML-attribute-escaped, not just HTML-text-escaped.
- **Trusted Types ready.** `sanitize()` returns a `TrustedHTML` when the runtime supports it, so policies can require trusted content.
- **No reachable `eval` in user surfaces.** Use of `new Function()` and `eval` is restricted to the `view` and `concurrency` modules and documented as such (see "CSP exceptions" below).
- **Cookies and headers validate input.** `createServer()`'s cookie API rejects header-unsafe characters before they reach a `Set-Cookie` header.

## API surfaces

```ts
import { sanitize, sanitizeHtml, escapeHtml, trusted } from '@bquery/bquery/security';
```

- `sanitizeHtml(input)` — strip dangerous tags, attributes, and protocols from an HTML string.
- `escapeHtml(input)` — escape `<`, `>`, `&`, `"`, `'` for safe text interpolation.
- `sanitize(input)` — return a Trusted Types `TrustedHTML` when available, otherwise an escaped string.
- `trusted(input)` — explicit escape hatch; document why every call is safe.

## Trusted Types

bQuery integrates with the [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) browser feature. When a Trusted Types policy is active:

- `sanitize()` returns a `TrustedHTML` produced by the bQuery policy.
- Components and view directives accept Trusted Types objects in addition to strings.
- Raw string assignments to `innerHTML` will throw — as they should.

If your app sets `Content-Security-Policy: require-trusted-types-for 'script'`, bQuery defaults will satisfy it.

## CSP and `unsafe-eval`

Two modules use dynamic function compilation internally:

- **`view`** — declarative `bq-*` directives compile to functions for performance. Templates are author-provided, not user input, but the underlying mechanism is `new Function()`.
- **`concurrency`** — zero-build worker tasks ship source code that the worker compiles at startup.

Both are documented exceptions, not patterns to copy. If your CSP forbids `unsafe-eval` and you use either module, see the respective module guide for opt-ins (precompiled view templates, pre-bundled worker sources).

## Escape hatches

You sometimes need to insert HTML that you already trust (a CMS-rendered fragment, an editor preview):

```ts
$('#article').raw.innerHTML = trustedHtmlFromCms; // bypasses sanitization
```

Use `.raw` explicitly. Every escape hatch should come with a comment documenting *why* the input is safe.

## Component-level discipline

When authoring components:

- Treat **props as untrusted** unless the component is internal-only.
- Sanitize before interpolating into HTML templates.
- Use `escapeHtml()` for text-style interpolation and `sanitizeHtml()` for HTML fragments.
- Prefer slots over `innerHTML` assembly when projecting child content.

## Form serialization

The forms module surfaces user input. The serialization helpers (`serializeFormState`, `readSerializedFormState`) treat form IDs strictly — IDs must match `[A-Za-z0-9_-]+` and unsupported characters throw rather than being silently normalised.

## Server-side guarantees

`createServer()` (the [Server module](/guide/server)) layers more defaults:

- **Body size limits** are enforced by streamed byte count *before* parsing JSON / form / multipart / text bodies.
- **Cookie attribute validation** rejects `;`, `\r`, and other header-unsafe characters.
- **`ServerHttpError`** is the canonical way to surface 4xx / 5xx; status codes propagate through `renderToResponse`.

## Reporting vulnerabilities

If you find a vulnerability, follow the [Security Policy](/contributing/security). Please **do not** open a public issue for security reports.

## See also

- [Security module guide](/guide/security)
- [View module guide](/guide/view) — CSP notes
- [Concurrency module guide](/guide/concurrency) — worker startup model
- [Forms module guide](/guide/forms) — SSR serialization rules
- [Server module guide](/guide/server) — body limits, cookie validation, `ServerHttpError`
- [Security Policy](/contributing/security)
