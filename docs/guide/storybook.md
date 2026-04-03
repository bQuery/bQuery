# Storybook

Use `@bquery/bquery/storybook` when you want string-based Storybook renderers that stay sanitized and ergonomic for Web Components.

```ts
import { storyHtml, when } from '@bquery/bquery/storybook';
```

---

## `storyHtml()`

A tagged template literal for authoring Storybook stories safely. It sanitizes interpolated values, preserves custom elements, and supports boolean-attribute shorthand.

### Signature

```ts
function storyHtml(
  strings: TemplateStringsArray,
  ...values: StoryValue[]
): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `strings` | `TemplateStringsArray` | The static parts of the template literal |
| `...values` | `StoryValue[]` | Interpolated values — strings, numbers, booleans, `null`, `undefined`, arrays of values, or callbacks returning values |

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
  render: ({ label }: { label: string }) =>
    storyHtml`<ui-button>${label}</ui-button>`,
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
function when(
  condition: unknown,
  truthyValue: StoryValue,
  falsyValue?: StoryValue
): string;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | `unknown` | Any truthy or falsy value |
| `truthyValue` | `StoryValue` | Rendered when `condition` is truthy — a string, callback, array, `null`, or `undefined` |
| `falsyValue` | `StoryValue` | Optional — rendered when `condition` is falsy |

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
