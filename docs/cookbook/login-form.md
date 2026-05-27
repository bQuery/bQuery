# Login form with validation

**Problem.** Validate a login form on input, disable submit until valid, surface server errors.

**Solution.** Use [`createForm`](/guide/forms) with [`compose`](/guide/forms) validators and `submitError`.

```ts
import { createForm, required, length, compose, withMessage } from '@bquery/bquery/forms';

const form = createForm({
  fields: {
    email: { initial: '', validators: required('Email is required.') },
    password: {
      initial: '',
      validators: compose(required('Password is required.'), withMessage(length({ min: 8 }), () => 'Use 8+ characters.')),
    },
  },
  mode: 'change',
  async onSubmit(values) {
    const res = await fetch('/login', { method: 'POST', body: JSON.stringify(values) });
    if (!res.ok) throw new Error(await res.text());
  },
});
```

```html
<form bq-on:submit.prevent="form.submit()">
  <input bq-model="form.fields.email.value" />
  <small bq-text="form.fields.email.errors[0]"></small>
  <input type="password" bq-model="form.fields.password.value" />
  <small bq-text="form.fields.password.errors[0]"></small>
  <button :disabled="!form.isValid.value || form.isSubmitting.value">Sign in</button>
  <p role="alert" bq-text="form.submitError.value"></p>
</form>
```

**Why it works.** `mode: 'change'` validates on every keystroke; throwing inside `onSubmit` populates `submitError` automatically.

## Related

- [Forms guide](/guide/forms)
- [Workflow — Forms + validation + i18n + a11y](/workflows/forms-validation)
- Longer worked example: [Examples & Recipes — Login form](/guide/examples#login-form-with-validation)
