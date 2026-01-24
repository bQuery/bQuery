---
title: View
---

The view module provides declarative DOM bindings similar to Vue/Svelte templates, but without requiring a compiler. Bindings are evaluated at runtime using bQuery's reactive system.

```ts
import { mount } from '@bquery/bquery/view';
import { signal, computed } from '@bquery/bquery/reactive';
```

## Basic Usage

```html
<div id="app">
  <input bq-model="name" />
  <p bq-text="greeting"></p>
</div>
```

```ts
const name = signal('World');
const greeting = computed(() => `Hello, ${name.value}!`);

const view = mount('#app', { name, greeting });
```

## Directives

### bq-text

Binds text content:

```html
<p bq-text="message"></p>
<span bq-text="count + ' items'"></span>
```

### bq-html

Binds innerHTML (sanitized by default):

```html
<div bq-html="richContent"></div>
```

Sanitization can be disabled (use with caution):

```ts
mount('#app', { content }, { sanitize: false });
```

### bq-if

Conditional rendering (removes/inserts element):

```html
<div bq-if="isLoggedIn">Welcome back!</div>
<div bq-if="!isLoggedIn">Please log in.</div>
```

### bq-show

Toggle visibility via CSS display:

```html
<div bq-show="isVisible">This toggles display: none</div>
```

### bq-class

Dynamic class binding:

```html
<!-- Object syntax -->
<div bq-class="{ active: isActive, disabled: isDisabled }"></div>

<!-- Expression returning string -->
<div bq-class="currentTheme"></div>

<!-- Expression returning array -->
<div bq-class="[baseClass, conditionalClass]"></div>
```

### bq-style

Dynamic inline styles:

```html
<!-- Object syntax -->
<div bq-style="{ color: textColor, fontSize: size + 'px' }"></div>

<!-- Expression returning object -->
<div bq-style="computedStyles"></div>
```

### bq-model

Two-way binding for inputs:

```html
<!-- Text input -->
<input bq-model="username" />

<!-- Checkbox -->
<input type="checkbox" bq-model="isChecked" />

<!-- Radio buttons -->
<input type="radio" value="a" bq-model="selected" />
<input type="radio" value="b" bq-model="selected" />

<!-- Select -->
<select bq-model="selectedOption">
  <option value="1">One</option>
  <option value="2">Two</option>
</select>
```

### bq-bind:attr

Bind any attribute:

```html
<a bq-bind:href="url" bq-bind:title="tooltip">Link</a>
<img bq-bind:src="imageSrc" bq-bind:alt="imageAlt" />
<button bq-bind:disabled="isDisabled">Submit</button>
```

Falsy values remove the attribute:

```html
<input bq-bind:required="isRequired" />
<!-- If isRequired is false, the 'required' attribute is removed -->
```

### bq-on:event

Event binding:

```html
<button bq-on:click="handleClick">Click me</button>
<input bq-on:input="updateValue" bq-on:blur="validate" />
<form bq-on:submit="handleSubmit">...</form>
```

Access the event object with `$event`:

```html
<button bq-on:click="handleClick($event)">Click</button> <input bq-on:keydown="onKey($event)" />
```

Access the element with `$el`:

```html
<input bq-on:focus="onFocus($el)" />
```

### bq-for

List rendering:

```html
<!-- Basic -->
<ul>
  <li bq-for="item in items" bq-text="item.name"></li>
</ul>

<!-- With index -->
<ul>
  <li bq-for="(item, index) in items">
    <span bq-text="index + 1"></span>:
    <span bq-text="item.name"></span>
  </li>
</ul>
```

### bq-ref

Element reference:

```html
<input bq-ref="inputEl" />
```

```ts
const inputEl = signal<HTMLInputElement | null>(null);

mount('#app', { inputEl });

// After mount, inputEl.value is the <input> element
inputEl.value?.focus();
```

## Mounting

### mount()

Mount a view to an existing element:

```ts
const view = mount('#app', {
  name: signal('World'),
  greeting: computed(() => `Hello, ${name.value}!`),
  handleClick: () => console.log('Clicked!'),
});
```

With options:

```ts
const view = mount('#app', context, {
  prefix: 'x', // Use x-text instead of bq-text
  sanitize: false, // Disable HTML sanitization
});
```

### View Instance

The returned view object:

```ts
type View = {
  el: Element; // The root element
  context: BindingContext; // The binding context
  update: (newContext: Partial<BindingContext>) => void;
  destroy: () => void; // Cleanup all effects
};
```

### Updating Context

```ts
const view = mount('#app', { count: signal(0) });

// Add new values to context
view.update({
  newValue: signal('hello'),
});
```

### Cleanup

Always destroy views when done:

```ts
view.destroy();
```

## Templates

Create reusable template functions:

```ts
import { createTemplate } from '@bquery/bquery/view';

const TodoItem = createTemplate(`
  <li bq-class="{ completed: done }">
    <input type="checkbox" bq-model="done" />
    <span bq-text="text"></span>
  </li>
`);

// Create instances
const item1 = TodoItem({
  done: signal(false),
  text: 'Buy groceries',
});

const item2 = TodoItem({
  done: signal(true),
  text: 'Walk the dog',
});

document.querySelector('#list')!.append(item1.el, item2.el);

// Cleanup
item1.destroy();
item2.destroy();
```

## Custom Prefix

Use a custom directive prefix:

```html
<div id="app">
  <p x-text="message"></p>
  <div x-if="showDetails">Details</div>
</div>
```

```ts
mount('#app', context, { prefix: 'x' });
```

## Expressions

Directives accept JavaScript expressions:

```html
<!-- Arithmetic -->
<span bq-text="count + 1"></span>

<!-- Ternary -->
<span bq-text="isActive ? 'Active' : 'Inactive'"></span>

<!-- Method calls -->
<span bq-text="items.length"></span>

<!-- Template literals (with proper escaping) -->
<span bq-text="`Total: ${total}`"></span>
```

## Integration with Components

Use view bindings inside Web Components:

```ts
import { component, html } from '@bquery/bquery/component';
import { mount } from '@bquery/bquery/view';
import { signal } from '@bquery/bquery/reactive';

component('counter-app', {
  connected() {
    const count = signal(0);

    mount(this.shadowRoot!, {
      count,
      increment: () => count.value++,
    });
  },
  render() {
    return html`
      <div>
        <span bq-text="count"></span>
        <button bq-on:click="increment()">+</button>
      </div>
    `;
  },
});
```

## Type Reference

```ts
type BindingContext = Record<string, unknown>;

type MountOptions = {
  prefix?: string; // Default: 'bq'
  sanitize?: boolean; // Default: true
};

type View = {
  el: Element;
  context: BindingContext;
  update: (newContext: Partial<BindingContext>) => void;
  destroy: () => void;
};
```

## Security Considerations

::: danger Expression Evaluation Warning
The view module uses `new Function()` to evaluate directive expressions at runtime. This is similar to how Vue and Alpine.js work, but carries important security implications.
:::

### What This Means

When you write:

```html
<span bq-text="user.name"></span>
```

The expression `user.name` is evaluated dynamically at runtime using JavaScript's `new Function()` constructor. This is essentially equivalent to `eval()` in terms of security.

### Safe Usage

✅ **DO** use expressions from developer-controlled templates:

```html
<!-- In your HTML file or template literal -->
<div bq-if="isLoggedIn" bq-text="username"></div>
```

✅ **DO** sanitize context values that come from users:

```ts
const userInput = signal(sanitizeHtml(untrustedInput));
mount('#app', { userInput });
```

### Unsafe Usage

❌ **NEVER** use expressions derived from user input:

```ts
// DANGEROUS! Never do this:
const userExpression = getUserInput(); // e.g., "alert('hacked')"
element.setAttribute('bq-text', userExpression);
mount(element, context);
```

❌ **NEVER** load templates with bq-\* attributes from untrusted sources:

```ts
// DANGEROUS! Template could contain malicious expressions:
const template = await fetch('/api/user-template').then((r) => r.text());
container.innerHTML = template;
mount(container, context); // Malicious bq-on:click expressions could execute
```

### If You Need User-Generated Templates

If your application requires loading templates from external sources:

1. **Validate attribute values** before mounting - strip or escape bq-\* attributes
2. **Use an allowlist** of permitted expressions
3. **Consider a sandboxed approach** using iframes for truly untrusted content
4. **Use static bindings** with sanitized values instead of dynamic expressions:

```ts
// Instead of allowing bq-text="userExpression"
// Use a safe static binding:
element.textContent = sanitizeHtml(userValue);
```

### Why Not Use a Safer Parser?

A fully sandboxed expression parser would:

- Add significant bundle size
- Reduce expression flexibility
- Still require careful security review

The current approach matches industry standards (Vue, Alpine, Angular) while keeping the library lightweight. The key is ensuring expressions come only from trusted sources.
