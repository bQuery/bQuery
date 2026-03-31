# Forms

The forms module provides reactive form state, sync/async validation, cross-field rules, and submit orchestration.

```ts
import { createForm, required, email, minLength } from '@bquery/bquery/forms';
```

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

Each field exposes reactive primitives for value and validation state.

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
import { createForm, required, matchField } from '@bquery/bquery/forms';
import { signal } from '@bquery/bquery/reactive';

const form = createForm({
  fields: {
    password: { initialValue: '', validators: [required()] },
    confirmPassword: {
      initialValue: '',
      validators: [
        required(),
        matchField(form.fields.password.value, 'Passwords must match'),
      ],
    },
  },
});
```

::: tip
`matchField()` accepts any object with a `.value` property, so it works with both signals and plain `{ value: T }` objects.
:::

Use forms when you want signal-based state without wiring every input manually.
