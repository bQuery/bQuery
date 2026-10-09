# One schema for client and server validation

**Problem.** The form validates in the browser, the API validates on the
server, and TypeScript needs the shape too. Three definitions drift apart.

**Solution.** Define the contract once as a
[Standard Schema](https://standardschema.dev) — here with Zod; Valibot or
ArkType work the same — and hand the same object to
[`createSchemaForm()`](/guide/forms#standard-schema-zod-valibot-arktype)
and to the server's [`validate()`](/guide/server#request-validation-with-standard-schema).

```ts
// shared/signup.ts — imported by both bundles
import { z } from 'zod';

export const Signup = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(12, 'Use at least 12 characters'),
  age: z.coerce.number().min(18, 'You must be 18 or older'),
});

export type SignupInput = z.input<typeof Signup>;
```

```ts
// server.ts
import { createServer, validate } from '@bquery/bquery/server';
import { Signup } from './shared/signup';

const signup = validate(Signup);
const app = createServer();

app.post(
  '/api/signup',
  async (ctx) => {
    const user = signup.data(ctx); // z.output<typeof Signup>: age is a number
    await createUser(user);
    return ctx.json({ ok: true }, { status: 201 });
  },
  [signup]
);
```

```ts
// client.ts
import { createSchemaForm } from '@bquery/bquery/forms';
import { createHttp, HttpError } from '@bquery/bquery/reactive';
import { Signup } from './shared/signup';

const api = createHttp({ baseUrl: '/api' });

export const form = createSchemaForm({
  schema: Signup,
  initialValues: { email: '', password: '', age: '' },
  validationStrategy: 'onBlur',
  async onSubmit(values) {
    try {
      await api.post('/signup', values);
    } catch (error) {
      // The server answers 400 with the same issue shape the form uses.
      const issues = (error as HttpError).response?.data as
        { issues?: Array<{ message: string; path: string[] }> } | undefined;
      for (const issue of issues?.issues ?? []) {
        // An issue about the whole object has no path and no field to show on.
        if (issue.path.length > 0) form.setErrors({ [String(issue.path[0])]: issue.message });
      }
      throw error;
    }
  },
});
```

**Why it works.** Both sides call the schema through the Standard Schema
interface, so they reject exactly the same input with exactly the same
messages, and `z.input` / `z.output` give the form and the route their types.
The server never trusts the client's check — `validate()` runs on every
request — but a valid form never round-trips just to learn about a typo. The
issue format `{ message, path }` is identical on both sides, so server-side
failures land on the right field.

See also: [Forms guide](/guide/forms), [Server guide](/guide/server).
