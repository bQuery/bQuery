# Forms

The forms module provides reactive form state, sync/async validation, cross-field rules, and submit orchestration.

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';
```

## Standalone fields with `useFormField()`

Use `useFormField()` when you want the same reactive field primitives as `createForm()`,
but without creating a whole form object.

```ts
import { useFormField, required } from '@bquery/bquery/forms';

const emailField = useFormField('', {
  validators: [required()],
  validateOn: 'blur',
});

emailField.value.value = 'ada@example.com';
emailField.touch(); // runs blur-triggered validation
console.log(emailField.isValid.value);
```

`useFormField()` supports:

- `validateOn: 'manual' | 'change' | 'blur' | 'both'`
- `debounceMs` for automatic validation
- external writable signals when you want to reuse existing reactive state
- `validate()` for immediate validation
- `destroy()` to cancel pending validation timers and automatic subscriptions for dynamic fields

## Basic usage

```ts
const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required(), minLength(2)] },
    email: { initialValue: '', validators: [required(), email()] },
  },
  onSubmit: async (values) => {
    await fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  },
});
```

## Field state

`createForm()` fields expose reactive primitives for value, error, and dirty/touched state.

```ts
console.log(form.fields.email.value.value);
console.log(form.fields.email.error.value);
console.log(form.fields.email.isTouched.value);
console.log(form.fields.email.isDirty.value);
```

Available helpers:

- `touch()`
- `reset()`
- `value`
- `error`
- `isTouched`
- `isDirty`
- `isPristine`

## Rendering errors with the view module

When you use `@bquery/bquery/view`, the `bq-error` directive can render field errors directly from a form field object or its `error` signal:

```html
<input bq-model="form.fields.email.value" />
<p bq-error="form.fields.email"></p>
```

```ts
import { createForm, email, required } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required(), email()] },
  },
});

mount('#app', { form });
```

The message element is hidden automatically while the field has no error.

Helpers available only on values returned by `useFormField()` (not on `createForm().fields.*`):

- `isValid`
- `isValidating`
- `validate()`
- `destroy()`

## Form state

```ts
console.log(form.isValid.value);
console.log(form.isDirty.value);
console.log(form.isSubmitting.value);
```

Form methods:

- `validateField(name)`
- `validate()`
- `handleSubmit()`
- `reset()`
- `getValues()`
- `setValues(values)` – bulk-set field values from a partial object
- `setErrors(errors)` – bulk-set field error messages (e.g. from server responses)

## Bulk-setting values and errors

Use `setValues()` to programmatically update multiple fields at once,
and `setErrors()` to apply server-side validation errors:

```ts
// Pre-fill from an API response
const userData = await fetch('/api/user/1').then((r) => r.json());
form.setValues({ name: userData.name, email: userData.email });

// Apply server-side validation errors
const result = await submitToServer(form.getValues());
if (result.errors) {
  form.setErrors(result.errors); // { name: 'Already taken', email: 'Invalid' }
}
```

## Cross-field validation

```ts
const passwordForm = createForm({
  fields: {
    password: { initialValue: '', validators: [required()] },
    confirmPassword: { initialValue: '', validators: [required()] },
  },
  crossValidators: [
    (values) =>
      values.password === values.confirmPassword
        ? undefined
        : { confirmPassword: 'Passwords must match' },
  ],
});
```

## Async validation

```ts
import { customAsync } from '@bquery/bquery/forms';

const usernameForm = createForm({
  fields: {
    username: {
      initialValue: '',
      validators: [
        required(),
        customAsync(async (value) => {
          const taken = await fetch(`/api/users/exists?name=${encodeURIComponent(String(value))}`)
            .then((response) => response.json())
            .then((data) => Boolean(data.taken));

          return taken ? 'Username is already taken' : true;
        }),
      ],
    },
  },
});
```

## Built-in validators

- `required()`
- `minLength(length)` / `maxLength(length)`
- `min(value)` / `max(value)`
- `pattern(regex)`
- `email()`
- `url()`
- `matchField(ref)` – compare field value to a reference signal (e.g. password confirmation)
- `custom(fn)`
- `customAsync(fn)`

## matchField validator

The `matchField()` validator compares a field's value against a reference signal.
This is the recommended approach for "confirm password" and similar patterns:

```ts
import { matchField } from '@bquery/bquery/forms';
import { signal } from '@bquery/bquery/reactive';

const password = signal('');
const confirmPassword = signal('');
const validateConfirmPassword = matchField(password, 'Passwords must match');

validateConfirmPassword(confirmPassword.value); // true when the values match
```

::: tip
`matchField()` accepts any object with a `.value` property, so it works with both signals and plain `{ value: T }` objects.
:::

## Complete form example with view bindings

Here is a full registration form combining `createForm()`, validators, and the view module for rendering:

```html
<form id="register-form" bq-on:submit="$event.preventDefault(); form.handleSubmit()">
  <div class="field">
    <label for="name">Name</label>
    <input id="name" bq-model="form.fields.name.value" placeholder="Your name" />
    <p bq-error="form.fields.name" class="error-text"></p>
  </div>

  <div class="field">
    <label for="email">Email</label>
    <input id="email" type="email" bq-model="form.fields.email.value" placeholder="you@example.com" />
    <p bq-error="form.fields.email" class="error-text"></p>
  </div>

  <div class="field">
    <label for="password">Password</label>
    <input id="password" type="password" bq-model="form.fields.password.value" />
    <p bq-error="form.fields.password" class="error-text"></p>
  </div>

  <div class="field">
    <label for="confirm">Confirm Password</label>
    <input id="confirm" type="password" bq-model="form.fields.confirmPassword.value" />
    <p bq-error="form.fields.confirmPassword" class="error-text"></p>
  </div>

  <button type="submit" bq-bind:disabled="form.isSubmitting.value || !form.isValid.value">
    Register
  </button>

  <p bq-show="form.isSubmitting.value">Submitting...</p>
</form>
```

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';
import { mount } from '@bquery/bquery/view';

const form = createForm({
  fields: {
    name: { initialValue: '', validators: [required(), minLength(2)] },
    email: { initialValue: '', validators: [required(), email()] },
    password: { initialValue: '', validators: [required(), minLength(8)] },
    confirmPassword: { initialValue: '', validators: [required()] },
  },
  crossValidators: [
    (values) =>
      values.password === values.confirmPassword
        ? undefined
        : { confirmPassword: 'Passwords must match' },
  ],
  onSubmit: async (values) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      form.setErrors(data.errors); // apply server-side errors
    }
  },
});

mount('#register-form', { form });
```

## Tips for beginners

- **Start with `useFormField()`** if you only need a single input validated — it's simpler than `createForm()`
- **Use `bq-error`** to show errors without manual DOM manipulation
- **Validators stack** — you can combine multiple validators on a single field: `[required(), minLength(3), email()]`
- **`form.isValid`** is reactive — use it in effects or bind it to disable buttons
- **`form.reset()`** clears all fields and errors back to initial state
- **Server-side errors** can be applied with `form.setErrors()` after a failed API call

Use forms when you want signal-based state without wiring every input manually.
