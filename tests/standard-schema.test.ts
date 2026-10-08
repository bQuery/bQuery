import { describe, expect, it } from 'bun:test';
import {
  createForm,
  isStandardSchema,
  normalizeSchemaIssues,
  required,
  schemaIssuesToFieldErrors,
  validateWithSchema,
  type StandardSchemaV1,
} from '../src/forms/index';
import { createServer, validate } from '../src/server/index';

const expectType = <T>(_value: T): void => {};

type Issue = StandardSchemaV1.Issue;

/**
 * A tiny Standard Schema implementation, standing in for Zod / Valibot /
 * ArkType so the tests exercise only the interface.
 */
const objectSchema = <Input extends Record<string, unknown>, Output = Input>(
  check: (value: Record<string, unknown>) => Issue[],
  options: { async?: boolean; transform?: (value: Input) => Output } = {}
): StandardSchemaV1<Input, Output> => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate(value) {
      const run = (): StandardSchemaV1.Result<Output> => {
        if (typeof value !== 'object' || value === null) {
          return { issues: [{ message: 'Expected an object' }] };
        }
        const issues = check(value as Record<string, unknown>);
        if (issues.length > 0) return { issues };
        const typed = value as Input;
        return {
          value: options.transform ? options.transform(typed) : (typed as unknown as Output),
        };
      };
      return options.async ? Promise.resolve().then(run) : run();
    },
  },
});

type Signup = { email: string; age: number };

const signupChecks = (value: Record<string, unknown>): Issue[] => {
  const issues: Issue[] = [];
  if (typeof value.email !== 'string' || !value.email.includes('@')) {
    issues.push({ message: 'Invalid email', path: ['email'] });
  }
  if (typeof value.age !== 'number' || value.age < 18) {
    issues.push({ message: 'Must be 18+', path: [{ key: 'age' }] });
  }
  return issues;
};

const Signup = objectSchema<Signup>(signupChecks);

describe('Standard Schema helpers (#221)', () => {
  it('detects Standard Schema objects', () => {
    expect(isStandardSchema(Signup)).toBe(true);
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema({ '~standard': { version: 2, validate() {} } })).toBe(false);
  });

  it('flattens issue paths and maps them to field errors', () => {
    const issues = normalizeSchemaIssues([
      { message: 'a', path: ['user', { key: 'name' }, 0] },
      { message: 'b', path: ['user'] },
      { message: 'root' },
      { message: 'proto', path: ['__proto__'] },
    ]);
    expect(issues[0]).toEqual({ message: 'a', path: ['user', 'name', 0] });
    const errors = schemaIssuesToFieldErrors(issues);
    expect(errors.user).toBe('a');
    expect(errors['']).toBe('root');
    expect(Object.getPrototypeOf(errors)).toBeNull();
    expect(({} as Record<string, unknown>).proto).toBeUndefined();
  });

  it('awaits async schemas', async () => {
    const schema = objectSchema<Signup>(signupChecks, { async: true });
    const ok = await validateWithSchema(schema, { email: 'a@b.c', age: 30 });
    expect(ok).toEqual({ success: true, value: { email: 'a@b.c', age: 30 } });
    const bad = await validateWithSchema(schema, { email: 'x', age: 30 });
    expect(bad.success).toBe(false);
    expect(bad.issues).toEqual([{ message: 'Invalid email', path: ['email'] }]);
  });
});

describe('createForm({ schema }) (#221)', () => {
  it('infers values from the schema and maps issues to fields', async () => {
    const form = createForm({
      schema: Signup,
      initialValues: { email: '', age: 0 },
    });
    expectType<{ email: string; age: number }>(form.getValues());

    expect(await form.validate()).toBe(false);
    expect(form.fields.email.error.value).toBe('Invalid email');
    expect(form.fields.age.error.value).toBe('Must be 18+');

    form.fields.email.value.value = 'ada@example.com';
    form.fields.age.value.value = 36;
    expect(await form.validate()).toBe(true);
    expect(form.fields.email.error.value).toBe('');
    expect(form.isValid.value).toBe(true);
    form.destroy();
  });

  it('validates a single field against the whole value', async () => {
    const form = createForm({ schema: Signup, initialValues: { email: 'bad', age: 0 } });
    await form.validateField('email');
    expect(form.fields.email.error.value).toBe('Invalid email');
    expect(form.fields.age.error.value).toBe('');
    form.destroy();
  });

  it('runs field validators before the schema', async () => {
    const form = createForm({
      schema: Signup,
      initialValues: { email: '', age: 20 },
      fields: { email: { validators: [required('Email is required')] } },
    });
    await form.validate();
    expect(form.fields.email.error.value).toBe('Email is required');
    form.destroy();
  });

  it('works with async schemas and submit', async () => {
    const submitted: unknown[] = [];
    const form = createForm({
      schema: objectSchema<Signup>(signupChecks, { async: true }),
      initialValues: { email: 'x', age: 20 },
      onSubmit: (values) => {
        submitted.push(values);
      },
    });

    await form.handleSubmit();
    expect(submitted).toEqual([]);
    expect(form.fields.email.error.value).toBe('Invalid email');

    form.fields.email.value.value = 'x@y.z';
    await form.handleSubmit();
    expect(submitted).toEqual([{ email: 'x@y.z', age: 20 }]);
    form.destroy();
  });

  it('fails validation for issues that no field displays', async () => {
    const schema = objectSchema<{ a: string; b: string }>((value) =>
      value.a === value.b ? [] : [{ message: 'a and b must match' }]
    );
    const form = createForm({ schema, initialValues: { a: 'x', b: 'y' } });
    expect(await form.validate()).toBe(false);
    expect(form.fields.a.error.value).toBe('');

    form.fields.b.value.value = 'x';
    expect(await form.validate()).toBe(true);
    form.destroy();
  });

  it('accepts a schema next to explicit fields', async () => {
    const form = createForm({
      fields: { email: { initialValue: 'nope' }, age: { initialValue: 40 } },
      schema: Signup,
    });
    expect(await form.validate()).toBe(false);
    expect(form.fields.email.error.value).toBe('Invalid email');
    form.destroy();
  });

  it('calls the schema again after an async run rejected', async () => {
    let calls = 0;
    const schema: StandardSchemaV1<Signup> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        async validate(value) {
          calls += 1;
          if (calls === 1) throw new Error('network blip');
          return { value: value as Signup };
        },
      },
    };
    const form = createForm({ schema, initialValues: { email: 'a@b.c', age: 20 } });

    await expect(form.validate()).rejects.toThrow('network blip');
    expect(await form.validate()).toBe(true);
    expect(calls).toBe(2);
    form.destroy();
  });

  it('runs the schema once per value snapshot', async () => {
    let runs = 0;
    const schema = objectSchema<Signup>((value) => {
      runs += 1;
      return signupChecks(value);
    });
    const form = createForm({ schema, initialValues: { email: 'a@b.c', age: 20 } });
    await form.validate();
    expect(runs).toBe(1);
    form.fields.age.value.value = 21;
    await form.validate();
    expect(runs).toBe(2);
    form.destroy();
  });
});

describe('validate() server middleware (#221)', () => {
  const post = (url: string, body: string, contentType = 'application/json') =>
    new Request(`http://localhost${url}`, {
      body,
      headers: { 'content-type': contentType },
      method: 'POST',
    });

  it('answers 400 with the issues when the body is invalid', async () => {
    const app = createServer();
    const signup = validate(Signup);
    app.post('/signup', (ctx) => ctx.json(signup.data(ctx)), [signup]);

    const response = await app.handle(post('/signup', JSON.stringify({ email: 'x', age: 3 })));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Validation failed',
      issues: [
        { message: 'Invalid email', path: ['email'] },
        { message: 'Must be 18+', path: ['age'] },
      ],
    });
  });

  it('exposes the validated output via data(ctx) and ctx.body()', async () => {
    const schema = objectSchema<Signup, Signup & { adult: true }>(signupChecks, {
      transform: (value) => ({ ...value, adult: true }),
    });
    const signup = validate(schema);
    const app = createServer();
    app.post(
      '/signup',
      async (ctx) => {
        const data = signup.data(ctx);
        expectType<{ email: string; age: number; adult: true }>(data);
        return ctx.json({ data, body: await ctx.body() });
      },
      [signup]
    );

    const response = await app.handle(post('/signup', JSON.stringify({ email: 'a@b.c', age: 20 })));
    expect(response.status).toBe(200);
    const expected = { email: 'a@b.c', age: 20, adult: true };
    expect(await response.json()).toEqual({ data: expected, body: expected });
  });

  it('validates form bodies, multipart bodies and the query string', async () => {
    const Search = objectSchema<{ q: string }>((value) =>
      typeof value.q === 'string' && value.q.length > 0
        ? []
        : [{ message: 'q is required', path: ['q'] }]
    );
    const app = createServer();
    const byBody = validate(Search);
    const byQuery = validate(Search, { source: 'query' });
    app.post('/form', (ctx) => ctx.json(byBody.data(ctx)), [byBody]);
    app.get('/search', (ctx) => ctx.json(byQuery.data(ctx)), [byQuery]);

    const form = await app.handle(post('/form', 'q=bquery', 'application/x-www-form-urlencoded'));
    expect(await form.json()).toEqual({ q: 'bquery' });

    const multipart = new FormData();
    multipart.set('q', 'multi');
    const multi = await app.handle(
      new Request('http://localhost/form', { body: multipart, method: 'POST' })
    );
    expect(await multi.json()).toEqual({ q: 'multi' });

    expect((await app.handle('/search?q=x')).status).toBe(200);
    expect((await app.handle('/search')).status).toBe(400);
  });

  it('supports a custom status and onInvalid', async () => {
    const app = createServer();
    app.post('/a', (ctx) => ctx.text('ok'), [validate(Signup, { status: 422 })]);
    app.post('/b', (ctx) => ctx.text('ok'), [
      validate(Signup, {
        onInvalid: (issues, ctx) =>
          ctx.text(issues.map((issue) => issue.message).join('|'), { status: 409 }),
      }),
    ]);

    expect((await app.handle(post('/a', '{}'))).status).toBe(422);
    const b = await app.handle(post('/b', JSON.stringify({ email: 'a@b.c', age: 1 })));
    expect(b.status).toBe(409);
    expect(await b.text()).toBe('Must be 18+');
  });

  it('throws when data() is read for an unvalidated request', async () => {
    const signup = validate(Signup);
    const app = createServer();
    app.post('/signup', (ctx) => ctx.json(signup.data(ctx)));

    const response = await app.handle(post('/signup', '{}'));
    expect(response.status).toBe(500);
  });
});
