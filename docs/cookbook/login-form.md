# Login form with validation

**Problem.** Validate a login form on input, disable submit until valid, surface server errors.

**Solution.** Use [`createForm`](/guide/forms) with built-in validators and `submitError`.

```ts
import { createForm, required, minLength } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    email: { initialValue: '', validators: [required('Email is required.')] },
    password: {
      initialValue: '',
      validators: [required('Password is required.'), minLength(8, 'Use 8+ characters.')],
    },
  },
  validationStrategy: 'onChange',
  async onSubmit(values) {
    const res = await fetch('/login', { method: 'POST', body: JSON.stringify(values) });
    if (!res.ok) throw new Error(await res.text());
  },
});
```

```html
<form bq-on:submit.prevent="form.handleSubmit()">
  <input bq-model="form.fields.email.value" />
  <small bq-show="form.fields.email.error.value" bq-text="form.fields.email.error.value"></small>
  <input type="password" bq-model="form.fields.password.value" />
  <small bq-show="form.fields.password.error.value" bq-text="form.fields.password.error.value"></small>
  <button :disabled="!form.isValid.value || form.isSubmitting.value">Sign in</button>
  <p role="alert" bq-text="form.submitError.value"></p>
</form>
```

**Why it works.** `validationStrategy: 'onChange'` validates on every keystroke; throwing inside `onSubmit` populates `submitError` automatically.

## Related

- [Forms guide](/guide/forms)
- [Workflow — Forms + validation + i18n + a11y](/workflows/forms-validation)
- Longer worked example: [Examples & Recipes — Login form](/guide/examples#login-form-with-validation)
