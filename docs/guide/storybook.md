# Storybook

::: tip What's new in 1.14.0
Storybook helpers gained `classMap`, `styleMap`, `ifDefined`, `repeat`, `storyText`, `unsafeHtml`, and `storySvg` in 1.14.0. See the [1.14.0 release notes](/release-notes/1.14#additive-module-expansions).
:::

Use `@bquery/bquery/storybook` when you want string-based Storybook renderers that stay sanitized and ergonomic for Web Components.

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';
```

---

## Stability: targeting Stable in 1.15.0

`storybook` has been **Beta** — a helper-only entry point (`storyHtml`, `when`, plus the 1.14.0 additions `classMap`, `styleMap`, `ifDefined`, `repeat`, `storyText`, `unsafeHtml`, `storySvg`). Those template helpers are one minor old, and `unsafeHtml` in particular needs a pinned security contract given bQuery's secure-by-default stance. The work to graduate it is tracked in [#148](https://github.com/bQuery/bQuery/issues/148): freeze the helper surface for one minor cycle, document each helper (especially the `unsafeHtml` boundary and how it interacts with the security sanitizer), and cover the helpers' output. Promotion to **Stable** then follows one full minor cycle with the surface frozen.

### Exit criteria

- [x] **Helper surface frozen for one minor** — see [Frozen surface reference](#frozen-surface-reference-1150) below.
- [x] **Helpers documented, with `unsafeHtml` security guidance** ([#148](https://github.com/bQuery/bQuery/issues/148)) — see [The security contract](#the-security-contract).
- [x] **Rendering output tested** ([#148](https://github.com/bQuery/bQuery/issues/148)) — sanitization of interpolated values, the `unsafeHtml` bypass, brand-spoofing rejection, and each helper's output are covered.
- [ ] **Surface frozen for one full minor** (no breaking changes) — demonstrated across the 1.15 cycle.

### Frozen surface reference (1.15.0)

The frozen public surface of `@bquery/bquery/storybook`:

- **Templates:** `storyHtml`, `storySvg`, `when`.
- **Helpers:** `classMap`, `styleMap`, `ifDefined`, `repeat`, `storyText`.
- **Escape hatch:** `unsafeHtml` (+ the `UnsafeHtmlMarker` / `StoryValue` types).

### The security contract

`storyHtml` (and `storySvg`) are **secure by default**: every interpolated value is run through the [security module's sanitizer](./security) (`sanitizeHtml`), and the template structure itself is sanitized. Dangerous markup — `<script>`, `onerror=`, `javascript:` URLs — is stripped, so interpolating untrusted data is safe.

`unsafeHtml(value)` is the **single, explicit opt-out**: it marks an author-controlled fragment to be re-inserted **verbatim** after the surrounding template is sanitized. It:

- only bypasses sanitization for the wrapped value — the rest of the template is still sanitized;
- emits a one-time dev warning so accidental use is visible;
- is **brand-checked** with a private symbol, so a plain object cannot spoof the marker to smuggle markup through;
- must **never** wrap user-supplied input — only trusted, author-controlled markup (icons, pre-vetted SVG, etc.).

```ts
import { storyHtml, unsafeHtml } from '@bquery/bquery/storybook';

// ✅ Safe: untrusted value is sanitized.
storyHtml`<bq-card>${userInput}</bq-card>`;

// ✅ Intentional: trusted, author-controlled markup inserted verbatim.
const trustedIcon = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>';
storyHtml`<bq-icon>${unsafeHtml(trustedIcon)}</bq-icon>`;

// ❌ Never do this — unsafeHtml around untrusted input defeats the sanitizer.
// storyHtml`<bq-card>${unsafeHtml(userInput)}</bq-card>`;
```

> `repeat()` escapes plain-string per-item results by default for the same reason. To emit trusted per-item markup, wrap the rendered fragment in `unsafeHtml(...)`, as its examples show.

---

## `storyHtml()`

A tagged template literal for authoring Storybook stories safely. It sanitizes interpolated values, preserves custom elements, and supports boolean-attribute shorthand.

### Signature

```ts
function storyHtml(strings: TemplateStringsArray, ...values: StoryValue[]): string;
```

| Parameter   | Type                   | Description                                                                                                            |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `strings`   | `TemplateStringsArray` | The static parts of the template literal                                                                               |
| `...values` | `StoryValue[]`         | Interpolated values — strings, numbers, booleans, `null`, `undefined`, arrays of values, or callbacks returning values |

**Returns:** A sanitized HTML string ready for Storybook rendering.

### Features

- **Sanitization by default** — All interpolated markup is sanitized via bQuery's security module
- **Custom element allowlist** — Custom elements found in the template structure are automatically allowed
- **Boolean attribute shorthand** — Use `?attrName=${booleanValue}` to conditionally set/remove boolean attributes

### Examples

**Basic story:**

```ts
export const Primary = {
  args: { label: 'Save' },
  render: ({ label }: { label: string }) => storyHtml`<ui-button>${label}</ui-button>`,
};
```

**Boolean attribute shorthand:**

```ts
export const Disabled = {
  args: { disabled: true, label: 'Save' },
  render: ({ disabled, label }: { disabled: boolean; label: string }) =>
    storyHtml`
      <ui-button ?disabled=${disabled}>${label}</ui-button>
    `,
};
```

When `disabled` is `true`, the output is `<ui-button disabled="">Save</ui-button>`.
When `disabled` is `false`, the attribute is omitted entirely.

**Composing multiple custom elements:**

```ts
export const Card = {
  args: { title: 'Dashboard', loading: false },
  render: ({ title, loading }: { title: string; loading: boolean }) =>
    storyHtml`
      <ui-card>
        <ui-card-header>${title}</ui-card-header>
        <ui-card-body ?loading=${loading}>
          <p>Card content goes here.</p>
        </ui-card-body>
      </ui-card>
    `,
};
```

**With reusable fragments:**

When you need to reuse a fragment, keep it as a string and pass it like any other interpolated value:

```ts
const badge = '<span class="badge">Stable</span>';

export const WithBadge = {
  render: () => storyHtml`<ui-card>${badge}</ui-card>`,
};
```

**Interpolating dynamic values:**

```ts
export const Counter = {
  args: { count: 0 },
  render: ({ count }: { count: number }) =>
    storyHtml`
      <ui-counter>
        <span>Count: ${count}</span>
      </ui-counter>
    `,
};
```

---

## `when()`

A conditional helper for readable inline fragments inside stories. Returns a string fragment based on a condition.

### Signature

```ts
function when(condition: unknown, truthyValue: StoryValue, falsyValue?: StoryValue): string;
```

| Parameter     | Type         | Description                                                                             |
| ------------- | ------------ | --------------------------------------------------------------------------------------- |
| `condition`   | `unknown`    | Any truthy or falsy value                                                               |
| `truthyValue` | `StoryValue` | Rendered when `condition` is truthy — a string, callback, array, `null`, or `undefined` |
| `falsyValue`  | `StoryValue` | Optional — rendered when `condition` is falsy                                           |

**Returns:** The resolved string fragment, or an empty string.

### Examples

**Simple conditional:**

```ts
export const Status = {
  args: { disabled: true },
  render: ({ disabled }: { disabled: boolean }) =>
    storyHtml`
      <ui-card>
        <ui-button ?disabled=${disabled}>Save</ui-button>
        ${when(disabled, '<small>Currently disabled</small>', '<small>Ready</small>')}
      </ui-card>
    `,
};
```

**With callback values:**

`when()` also accepts callbacks that return fragments — useful for expensive computations:

```ts
export const DetailView = {
  args: { expanded: false },
  render: ({ expanded }: { expanded: boolean }) =>
    storyHtml`
      <ui-panel>
        ${when(
          expanded,
          () => '<div class="details">Full details here...</div>',
          () => '<span>Show more</span>'
        )}
      </ui-panel>
    `,
};
```

**Omitting the falsy branch:**

When no `falsyValue` is provided, an empty string is returned for falsy conditions:

```ts
export const OptionalBadge = {
  args: { showBadge: true },
  render: ({ showBadge }: { showBadge: boolean }) =>
    storyHtml`
      <ui-button>
        Save ${when(showBadge, '<span class="dot"></span>')}
      </ui-button>
    `,
};
```

---

## Best Practices

- **Keep literal template structure developer-authored.** The static parts of `storyHtml` templates define the safe structure. Only dynamic user data should be interpolated.
- **Pass user-controlled content as interpolated values** so sanitization stays effective. Never build HTML strings manually.
- **Prefer `storyHtml()` over manual string concatenation.** It handles escaping, boolean attributes, and custom element allowlisting automatically.
- **Use Storybook args for booleans** and map them with `?attr=${value}` where possible.
- **Keep reusable fragments string-based.** `storyHtml()` already sanitizes the final output.
- **Combine `when()` with `storyHtml()`** for readable conditional rendering without ternary chains.

---

## Full Example

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';

export default {
  title: 'Components/Button',
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    showIcon: { control: 'boolean' },
  },
};

export const Interactive = {
  args: {
    variant: 'primary',
    disabled: false,
    label: 'Save',
    showIcon: true,
  },
  render: ({ variant, disabled, label, showIcon }) =>
    storyHtml`
      <ui-button
        variant="${variant}"
        ?disabled=${disabled}
      >
        ${when(showIcon, '<span class="icon" aria-hidden="true">💾</span>')}
        ${label}
      </ui-button>
    `,
};
```

## Helpers added in 1.14.0

The Storybook module ships several ergonomic helpers that mirror the
`lit-html` conventions used by `@storybook/web-components`, so existing
community examples translate one-to-one.

### `classMap` and `styleMap`

Build `class` attribute values from plain objects. `styleMap` still returns a
CSS declaration string, but `storyHtml` sanitizes inline `style=""`
attributes, so prefer classes or CSS custom properties in story markup:

```ts
import { classMap, storyHtml } from '@bquery/bquery/storybook';

export const Card = {
  args: { primary: true, disabled: false, tone: 'danger' },
  render: ({ primary, disabled, tone }) => storyHtml`
    <ui-card
      class="${classMap({ primary, disabled })}"
      data-tone="${tone}"
    ></ui-card>
  `,
};
```

`classMap` joins truthy keys with a single space. `styleMap` is still useful
when another API expects a CSS text string, but interpolating it into
`storyHtml` `style=""` attributes will be sanitized away unless you opt into a
trusted `unsafeHtml(...)` escape hatch yourself.

### `ifDefined`

Returns the value as a string when defined, otherwise returns an empty
string. When used inside `attr="${...}"`, that renders as `attr=""`.
Useful for optional Storybook args:

```ts
storyHtml`<ui-input placeholder="${ifDefined(args.placeholder)}"></ui-input>`;
```

### `repeat`

Keyed list helper that maps `items` to `storyHtml` fragments and emits
stable `data-bq-key` markers for Storybook's actions panel. Plain string
results are escaped as text; wrap trusted fragments with `unsafeHtml(...)`:

```ts
import { repeat, storyHtml, unsafeHtml } from '@bquery/bquery/storybook';

const items = [
  { id: 'a', label: 'Apple' },
  { id: 'b', label: 'Banana' },
];

storyHtml`
  <ul>
    ${repeat(
      items,
      (item) => unsafeHtml(storyHtml`<li>${item.label}</li>`),
      (item) => item.id
    )}
  </ul>
`;
```

### `storyText`

Escape-only helper for text-only fragments. Use this when interpolating
user-supplied strings without any allowlist inference:

```ts
storyHtml`<bq-tooltip>${storyText(userInput)}</bq-tooltip>`;
```

### `unsafeHtml`

Opt-in escape hatch that bypasses the sanitizer for a single
interpolation. Use this only for content you already trust (icons,
pre-rendered fragments from a server-side process, etc.). Every call
site is reviewable, mirroring `lit-html`'s `unsafeHTML`:

```ts
import { storyHtml, unsafeHtml } from '@bquery/bquery/storybook';

storyHtml`<ui-card>${unsafeHtml(trustedIconSvg)}</ui-card>`;
```

### `storySvg`

Tagged template for SVG-rooted stories. The static template is treated
as author-trusted (the HTML sanitizer cannot run on `<svg>` content),
and every interpolated value is HTML-escaped so user-supplied args
cannot inject markup. Use `unsafeHtml` to splice pre-built SVG fragments
into a `storySvg` template.

```ts
import { storySvg } from '@bquery/bquery/storybook';

export const Icon = {
  args: { size: 24, color: 'currentColor' },
  render: ({ size, color }) => storySvg`
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="${color}" />
    </svg>
  `,
};
```

<!-- uniform-template-footer -->

## Pitfalls and gotchas

- `storyText` is the safe default — prefer it over interpolating user content into raw template strings.
- `unsafeHtml` skips sanitization; only use with trusted constants.
- `classMap` / `styleMap` accept reactive signals — read `.value` first if you only want a snapshot.
- `ifDefined` distinguishes `undefined` (skip attribute) from `null` (render `null`); be explicit.
- `repeat()` requires stable keys for stable controls in the Storybook UI.

## Performance notes

- Stories are mounted lightly — avoid heavy global setup outside `decorators`.
- Combine `storyText` with a fixed locale to keep snapshot tests deterministic.

## Testing this module

- Pair with `@bquery/bquery/testing`'s `renderComponent()` to assert story output.

## Related modules

- [Component](./components) — the units being storied.
- [Testing](./testing) — share helpers for component assertions.

## Version history

- **1.15.0** — **targeting Stable**: helper surface frozen for one minor cycle ([#148](https://github.com/bQuery/bQuery/issues/148)). `unsafeHtml` security contract pinned and documented (verbatim only for trusted, brand-checked fragments; the surrounding template stays sanitized); helper output covered by tests.
- **1.14.0** — `classMap`, `styleMap`, `ifDefined`, `repeat`, `storyText`, `unsafeHtml`, `storySvg`.
