# Forms with validation, i18n, and a11y

A reusable sign-up form combining [Forms](/guide/forms) validation, [i18n](/guide/i18n) translated messages, and [A11y](/guide/a11y) live-region announcements.

## 1. Schema-style configuration

```ts
// src/signup-form.ts
import {
  createForm,
  required,
  email,
  minLength,
  oneOf,
} from '@bquery/bquery/forms';
import { t } from '@bquery/bquery/i18n';

export const form = createForm({
  fields: {
    email: {
      initialValue: '',
      validators: [
        (value) => required(t('errors.required'))(value),
        (value) => email(t('errors.email'))(value),
      ],
    },
    password: {
      initialValue: '',
      validators: [
        (value) => required(t('errors.required'))(value),
        (value) => minLength(8, t('errors.password.short'))(value),
      ],
    },
    plan: {
      initialValue: 'free',
      validators: [(value) => oneOf(['free', 'pro'], t('errors.plan'))(value)],
    },
  },
  validationStrategy: 'onChange',
  mode: 'first',
  async onSubmit(values) {
    const res = await fetch('/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error(await res.text());
  },
});
```

Each validator calls `t()` when validation runs, so the active locale decides which message string is returned.

## 2. Announce errors to assistive tech

```ts
// src/announce.ts
import { createLiveRegion } from '@bquery/bquery/a11y';
import { effect } from '@bquery/bquery/reactive';
import { form } from './signup-form';

const region = createLiveRegion({ priority: 'assertive' });

effect(() => {
  const errors = Object.values(form.errors)
    .map((error) => error.value)
    .filter(Boolean);
  if (errors.length === 0) return;
  region.announce(errors.join('. '));
});
```

The live region is created once and reused — every announcement is debounced into a single assertive update.

## 3. Bind the form declaratively

```html
<form bq-on:submit.prevent="form.handleSubmit()">
  <label>
    <span bq-text="t('email.label')"></span>
    <input
      type="email"
      bq-model="form.fields.email.value"
      bq-aria="{ invalid: Boolean(form.fields.email.error.value) }"
    />
    <small
      bq-show="form.fields.email.error.value"
      bq-text="form.fields.email.error.value"
    ></small>
  </label>

  <label>
    <span bq-text="t('password.label')"></span>
    <input type="password" bq-model="form.fields.password.value" />
    <small
      bq-show="form.fields.password.error.value"
      bq-text="form.fields.password.error.value"
    ></small>
  </label>

  <fieldset>
    <legend bq-text="t('plan.label')"></legend>
    <label><input type="radio" bq-model="form.fields.plan.value" value="free" /> Free</label>
    <label><input type="radio" bq-model="form.fields.plan.value" value="pro" /> Pro</label>
  </fieldset>

  <button :disabled="form.isSubmitting.value || !form.isValid.value">
    <span bq-text="form.isSubmitting.value ? t('submitting') : t('submit')"></span>
  </button>

  <p bq-show="form.submitError.value" bq-text="form.submitError.value" role="alert"></p>
</form>
```

## 4. Locale-aware validation messages

```ts
// src/locales/en.ts
export default {
  email: { label: 'Email' },
  password: { label: 'Password' },
  plan: { label: 'Plan' },
  submit: 'Create account',
  submitting: 'Working…',
  errors: {
    required: 'This field is required.',
    email: 'Enter a valid email address.',
    password: { short: 'Use at least 8 characters.' },
    plan: 'Choose a plan.',
  },
};
```

When the user switches locale via `setLocale('de')`, the next validation pass calls `t()` again and the live region announces the translated error.

## 5. Keyboard / focus polish

```ts
import { focusVisible } from '@bquery/bquery/a11y';

focusVisible(document.body); // adds .focus-visible class only for keyboard users
```

Combine with CSS:

```css
:focus { outline: none; }
.focus-visible :focus { outline: 2px solid var(--accent); outline-offset: 2px; }
```

## What you exercised

- **Schema-style forms** keep validators tree-shakeable and composable.
- **Reactive translations** automatically refresh error messages on locale change.
- **Live regions** make validation accessible without forcing focus into the form.
- **focus-visible** keeps mouse interactions outline-free while preserving keyboard cues.

## Next steps

- Persist the form state across navigations with [`serializeFormState`](/guide/forms).
- Add SSR with [`hydrateForm`](/guide/forms) so users keep their input after a page reload.
- Pair with the [Drag-and-drop workflow](./sortable-keyboard) for re-ordering plan add-ons.
