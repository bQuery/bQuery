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
  <small
    bq-show="form.fields.password.error.value"
    bq-text="form.fields.password.error.value"
  ></small>
  <button :disabled="!form.isValid.value || form.isSubmitting.value">Sign in</button>
  <p role="alert" bq-text="form.submitError.value"></p>
</form>
```

**Why it works.** `validationStrategy: 'onChange'` validates on every keystroke; throwing inside `onSubmit` populates `submitError` automatically.

## Rate-limit the endpoint

Client-side validation stops typos, not a password-guessing script. The
`/login` route this form posts to needs a limit of its own:

```ts
import { createServer, rateLimit, session } from '@bquery/bquery/server';

const app = createServer();
app.use(session({ secret: process.env.SECRET! }));

app.post('/login', handleLogin, [
  rateLimit({
    window: 15 * 60_000,
    max: 5,
    // Behind a proxy, key on the address it reports. Do not key on
    // `ctx.session?.$id` here: it is `null` until a session is written, and a
    // `null` key skips the limit — so a script that simply sends no cookie
    // would get unlimited attempts. Without a proxy, use a counted fallback
    // such as `keyBy: (ctx) => ctx.session?.$id ?? 'anon'`.
    trustProxy: true,
    // A correct password should not spend budget — only failures count.
    // Note this refunds 2xx only, so a redirect-on-failure form still counts.
    skipSuccessfulRequests: true,
  }),
]);
```

Attempts past the fifth get `429` with `Retry-After`, and the form surfaces
the body through `submitError` like any other server error. See
[Rate limiting](/guide/server#rate-limiting) for choosing `keyBy` and for
sharing counters across processes.

## Related

- [Forms guide](/guide/forms)
- [Server — Rate limiting](/guide/server#rate-limiting)
- [Workflow — Forms + validation + i18n + a11y](/workflows/forms-validation)
- Longer worked example: [Examples & Recipes — Login form](/guide/examples#login-form-with-validation)
