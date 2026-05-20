import { describe, expect, it } from 'bun:test';
import {
  all,
  arrayOf,
  between,
  bindField,
  bindForm,
  compose,
  createFieldArray,
  createForm,
  dateAfter,
  dateBefore,
  field,
  fileSize,
  fileType,
  hydrateForm,
  integer,
  validDate,
  length,
  minLength,
  not,
  notOneOf,
  numeric,
  oneOf,
  readSerializedFormState,
  required,
  requiredIf,
  requiredUnless,
  schema,
  serializeFormState,
  useFormField,
  withMessage,
} from '../src/forms/index';

// ---------------------------------------------------------------------------
// New validators
// ---------------------------------------------------------------------------

describe('forms/validators (new)', () => {
  describe('integer', () => {
    it('accepts integer numbers and integer strings', () => {
      expect(integer()(42)).toBe(true);
      expect(integer()('42')).toBe(true);
      expect(integer()('-3')).toBe(true);
    });
    it('rejects decimals and non-numeric strings', () => {
      expect(integer()(3.14)).toBe('Must be an integer');
      expect(integer()('3.14')).toBe('Must be an integer');
      expect(integer()('abc')).toBe('Must be an integer');
    });
    it('treats null/undefined/empty as valid', () => {
      expect(integer()(null)).toBe(true);
      expect(integer()(undefined)).toBe(true);
      expect(integer()('')).toBe(true);
    });
    it('honors custom message', () => {
      expect(integer('Whole numbers only')(1.5)).toBe('Whole numbers only');
    });
  });

  describe('numeric', () => {
    it('accepts numbers and numeric strings', () => {
      expect(numeric()(3.14)).toBe(true);
      expect(numeric()('3.14')).toBe(true);
      expect(numeric()('1e3')).toBe(true);
    });
    it('rejects non-numeric strings', () => {
      expect(numeric()('abc')).toBe('Must be a number');
    });
    it('rejects Infinity and NaN', () => {
      expect(numeric()(Infinity)).toBe('Must be a number');
      expect(numeric()(NaN)).toBe('Must be a number');
    });
  });

  describe('between', () => {
    it('accepts values in range inclusive', () => {
      expect(between(1, 10)(5)).toBe(true);
      expect(between(1, 10)(1)).toBe(true);
      expect(between(1, 10)(10)).toBe(true);
    });
    it('rejects values out of range', () => {
      expect(between(1, 10)(0)).toBe('Must be between 1 and 10');
      expect(between(1, 10)(11)).toBe('Must be between 1 and 10');
    });
  });

  describe('length', () => {
    it('checks exact string length', () => {
      expect(length(3)('abc')).toBe(true);
      expect(length(3)('ab')).toBe('Must be exactly 3 characters');
    });
    it('checks exact array length', () => {
      expect(length(2)([1, 2])).toBe(true);
      expect(length(2)([1])).toBe('Must be exactly 2 characters');
    });
  });

  describe('oneOf / notOneOf', () => {
    it('accepts allowed values', () => {
      expect(oneOf(['a', 'b'])('a')).toBe(true);
      expect(oneOf(['a', 'b'])('c')).toBe('Invalid value');
    });
    it('rejects blocked values', () => {
      expect(notOneOf(['admin', 'root'])('admin')).toBe('Value is not allowed');
      expect(notOneOf(['admin', 'root'])('user')).toBe(true);
    });
  });

  describe('arrayOf', () => {
    it('validates every item with the inner validator', () => {
      const v = arrayOf(required('Required'));
      expect(v(['a', 'b'])).toBe(true);
      expect(v(['a', ''])).toBe('[1] Required');
    });
    it('passes through non-array values', () => {
      const v = arrayOf(required('Required'));
      expect(v('not an array' as unknown as readonly string[])).toBe(true);
    });
    it('supports async inner validators', async () => {
      const asyncReq = async (value: string) => (value ? true : 'nope');
      const v = arrayOf(asyncReq);
      const result = await v(['x', '']);
      expect(result).toBe('[1] nope');
    });
  });

  describe('requiredIf / requiredUnless', () => {
    it('only requires when predicate is true', () => {
      const v = requiredIf<string>(() => true);
      expect(v('')).toBe('This field is required');
    });
    it('passes when predicate is false', () => {
      const v = requiredIf<string>(() => false);
      expect(v('')).toBe(true);
    });
    it('requiredUnless is the inverse', () => {
      expect(requiredUnless<string>(() => true)('')).toBe(true);
      expect(requiredUnless<string>(() => false)('')).toBe('This field is required');
    });
  });

  describe('validDate / dateAfter / dateBefore', () => {
    it('accepts valid date strings and Date instances', () => {
      expect(validDate()('2024-01-01')).toBe(true);
      expect(validDate()(new Date())).toBe(true);
      expect(validDate()('not a date')).toBe('Invalid date');
    });
    it('checks before/after correctly', () => {
      expect(dateAfter('2024-01-01')('2024-06-01')).toBe(true);
      expect(dateAfter('2024-06-01')('2024-01-01')).toContain('Must be after');
      expect(dateBefore('2024-06-01')('2024-01-01')).toBe(true);
      expect(dateBefore('2024-01-01')('2024-06-01')).toContain('Must be before');
    });
  });

  describe('fileSize / fileType', () => {
    it('validates File size when File is available', () => {
      if (typeof File === 'undefined') return;
      const small = new File(['a'], 'a.txt', { type: 'text/plain' });
      expect(fileSize(10)(small)).toBe(true);
      expect(fileSize(0)(small)).toContain('File must be at most');
    });
    it('validates File mime type with wildcards', () => {
      if (typeof File === 'undefined') return;
      const png = new File(['x'], 'a.png', { type: 'image/png' });
      expect(fileType(['image/*'])(png)).toBe(true);
      expect(fileType(['text/plain'])(png)).toContain('File must be one of');
    });
    it('passes through non-file values', () => {
      expect(fileSize(10)(null)).toBe(true);
      expect(fileType(['image/*'])('hello')).toBe(true);
    });
  });

  describe('compose / all / not / withMessage', () => {
    it('compose short-circuits at the first failure', () => {
      const v = compose<string>(required(), minLength(3, 'Too short'));
      expect(v('')).toBe('This field is required');
      expect(v('ab')).toBe('Too short');
      expect(v('abc')).toBe(true);
    });

    it('all collects every failure', () => {
      const v = all<string>([required('Req'), minLength(3, 'Short')]);
      expect(v('')).toBe('Req; Short');
      expect(v('ab')).toBe('Short');
      expect(v('abc')).toBe(true);
    });

    it('not inverts validator outcome', () => {
      const v = not(oneOf(['admin']), 'Reserved');
      expect(v('admin')).toBe('Reserved');
      expect(v('alice')).toBe(true);
    });

    it('withMessage overrides the error message', () => {
      const v = withMessage(required(), 'Required please');
      expect(v('')).toBe('Required please');
      expect(v('ok')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Field-level extensions
// ---------------------------------------------------------------------------

describe('forms/field extensions', () => {
  it('tracks isFocused via focus()/blur()', () => {
    const form = createForm({ fields: { name: { initialValue: '' } } });
    expect(form.fields.name.isFocused.value).toBe(false);
    form.fields.name.focus();
    expect(form.fields.name.isFocused.value).toBe(true);
    form.fields.name.blur();
    expect(form.fields.name.isFocused.value).toBe(false);
    expect(form.fields.name.isTouched.value).toBe(true);
  });

  it('records dirtySince when value first changes', () => {
    const form = createForm({ fields: { name: { initialValue: '' } } });
    expect(form.fields.name.dirtySince.value).toBeNull();
    form.fields.name.value.value = 'A';
    expect(form.fields.name.dirtySince.value).toBeGreaterThan(0);
    form.fields.name.value.value = '';
    expect(form.fields.name.dirtySince.value).toBeNull();
  });

  it('supports setValue with touch options', async () => {
    const form = createForm({
      fields: { age: { initialValue: 0, validators: [integer()] } },
    });
    form.fields.age.setValue(5, { touch: true });
    expect(form.fields.age.value.value).toBe(5);
    expect(form.fields.age.isTouched.value).toBe(true);
  });

  it('setError/clearError mutate the error signal', () => {
    const form = createForm({ fields: { name: { initialValue: '' } } });
    form.fields.name.setError('Bad');
    expect(form.fields.name.error.value).toBe('Bad');
    form.fields.name.clearError();
    expect(form.fields.name.error.value).toBe('');
  });

  it('disabled fields are skipped by validate()', async () => {
    const form = createForm({
      fields: {
        name: { initialValue: '', validators: [required()], disabled: true },
        age: { initialValue: 0 },
      },
    });
    const ok = await form.validate();
    expect(ok).toBe(true);
    expect(form.fields.name.error.value).toBe('');
  });

  it('parse transforms incoming values via setValues()', () => {
    const form = createForm({
      fields: {
        n: { initialValue: 0, parse: (v) => Number(v) },
      },
    });
    form.setValues({ n: '42' as unknown as number });
    expect(form.fields.n.value.value).toBe(42);
  });

  it('per-field validateOn:change triggers validation automatically', async () => {
    const form = createForm({
      fields: {
        n: { initialValue: '', validators: [required('Req')], validateOn: 'change' },
      },
    });
    form.fields.n.value.value = '';
    // Value didn't actually change yet (still ''), so error stays empty
    form.fields.n.value.value = 'x';
    await Promise.resolve();
    form.fields.n.value.value = '';
    await new Promise((r) => setTimeout(r, 5));
    expect(form.fields.n.error.value).toBe('Req');
  });

  it('per-field debounceMs delays automatic validation', async () => {
    const form = createForm({
      fields: {
        n: {
          initialValue: 'x',
          validators: [required('Req')],
          validateOn: 'change',
          debounceMs: 30,
        },
      },
    });
    form.fields.n.value.value = '';
    expect(form.fields.n.error.value).toBe('');
    await new Promise((r) => setTimeout(r, 50));
    expect(form.fields.n.error.value).toBe('Req');
    form.destroy();
  });

  it('per-field validateOn:blur revalidates on every blur', async () => {
    const form = createForm({
      fields: {
        n: { initialValue: 'ok', validators: [required('Req')], validateOn: 'blur' },
      },
    });

    form.fields.n.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(form.fields.n.error.value).toBe('');

    form.fields.n.value.value = '';
    form.fields.n.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(form.fields.n.error.value).toBe('Req');

    form.fields.n.value.value = 'fixed';
    form.fields.n.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(form.fields.n.error.value).toBe('');
  });

  it('ignores stale async validation results in createForm()', async () => {
    const form = createForm({
      fields: {
        username: {
          initialValue: '',
          validateOn: 'change',
          validators: [
            async (value: string) => {
              if (value === 'slow') {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return 'Taken';
              }

              await new Promise((resolve) => setTimeout(resolve, 0));
              return true;
            },
          ],
        },
      },
    });

    form.fields.username.value.value = 'slow';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.fields.username.isValidating.value).toBe(true);

    form.fields.username.value.value = 'fast';
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(form.fields.username.error.value).toBe('');
    expect(form.fields.username.isValidating.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Form-level extensions
// ---------------------------------------------------------------------------

describe('forms/form extensions', () => {
  it('tracks submitCount, lastSubmittedAt, submitError', async () => {
    const form = createForm({
      fields: { name: { initialValue: 'a' } },
      onSubmit: async () => {
        /* ok */
      },
    });
    await form.handleSubmit();
    expect(form.submitCount.value).toBe(1);
    expect(form.lastSubmittedAt.value).toBeGreaterThan(0);
    expect(form.submitError.value).toBeNull();
  });

  it('captures submitError when onSubmit throws without onSubmitError', async () => {
    const err = new Error('boom');
    const form = createForm({
      fields: { name: { initialValue: 'a' } },
      onSubmit: () => {
        throw err;
      },
    });
    let thrown: unknown;
    try {
      await form.handleSubmit();
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBe(err);
    expect(form.submitError.value).toBe(err);
  });

  it('calls onSubmitSuccess after a successful submit', async () => {
    const events: string[] = [];
    const form = createForm({
      fields: { name: { initialValue: 'a' } },
      onSubmit: async () => events.push('submit'),
      onSubmitSuccess: async (values) => events.push(`success:${values.name}`),
    });
    await form.handleSubmit();
    expect(events).toEqual(['submit', 'success:a']);
  });

  it('routes throw to onSubmitError when provided (no rethrow)', async () => {
    let captured: unknown;
    const form = createForm({
      fields: { name: { initialValue: 'a' } },
      onSubmit: () => {
        throw new Error('nope');
      },
      onSubmitError: (err) => {
        captured = err;
      },
    });
    await form.handleSubmit();
    expect(captured).toBeInstanceOf(Error);
    expect(form.submitError.value).toBeInstanceOf(Error);
  });

  it('touchAll/untouchAll toggle every field', () => {
    const form = createForm({
      fields: { a: { initialValue: '' }, b: { initialValue: '' } },
    });
    form.touchAll();
    expect(form.fields.a.isTouched.value).toBe(true);
    expect(form.fields.b.isTouched.value).toBe(true);
    form.untouchAll();
    expect(form.fields.a.isTouched.value).toBe(false);
  });

  it('resetField resets only the named field', () => {
    const form = createForm({
      fields: { a: { initialValue: 'x' }, b: { initialValue: 'y' } },
    });
    form.fields.a.value.value = '1';
    form.fields.b.value.value = '2';
    form.resetField('a');
    expect(form.fields.a.value.value).toBe('x');
    expect(form.fields.b.value.value).toBe('2');
  });

  it('resetErrors clears all errors without changing values', () => {
    const form = createForm({ fields: { a: { initialValue: 'x' } } });
    form.setErrors({ a: 'bad' });
    form.fields.a.value.value = 'y';
    form.resetErrors();
    expect(form.fields.a.error.value).toBe('');
    expect(form.fields.a.value.value).toBe('y');
  });

  it('getDirtyValues returns only changed fields', () => {
    const form = createForm({
      fields: { a: { initialValue: 'x' }, b: { initialValue: 'y' } },
    });
    form.fields.a.value.value = 'a2';
    expect(form.getDirtyValues()).toEqual({ a: 'a2' });
  });

  it('subscribe receives notifications on value changes', async () => {
    const form = createForm({
      fields: { a: { initialValue: '' }, b: { initialValue: '' } },
    });
    const events: Array<{ a: string; b: string }> = [];
    const unsub = form.subscribe((values) => events.push(values));
    form.fields.a.value.value = '1';
    await new Promise((r) => setTimeout(r, 0));
    form.fields.b.value.value = '2';
    await new Promise((r) => setTimeout(r, 0));
    expect(events.length).toBeGreaterThanOrEqual(2);
    unsub();
    form.fields.a.value.value = '3';
    await new Promise((r) => setTimeout(r, 0));
    // unsub should have stopped notifications, count stays the same
    expect(events[events.length - 1]).toMatchObject({ a: '1', b: '2' });
  });

  it('validationStrategy: onChange triggers field validation on change', async () => {
    const form = createForm({
      fields: { a: { initialValue: '', validators: [required()] } },
      validationStrategy: 'onChange',
    });
    form.fields.a.value.value = 'x';
    await new Promise((r) => setTimeout(r, 5));
    expect(form.fields.a.error.value).toBe('');
    form.fields.a.value.value = '';
    await new Promise((r) => setTimeout(r, 5));
    expect(form.fields.a.error.value).toBe('This field is required');
    form.destroy();
  });

  it('mode: "all" collects every per-field validation error', async () => {
    const form = createForm({
      fields: {
        n: { initialValue: '', validators: [required('Req'), minLength(3, 'Short')] },
      },
      mode: 'all',
    });
    await form.validate();
    expect(form.fields.n.error.value).toBe('Req; Short');
  });

  it('snapshot/restore round-trips values, errors, touched', () => {
    const a = createForm({
      fields: { x: { initialValue: '' }, y: { initialValue: '' } },
    });
    a.fields.x.value.value = 'hello';
    a.setErrors({ y: 'bad' });
    a.fields.y.touch();
    const snap = a.snapshot();

    const b = createForm({
      fields: { x: { initialValue: '' }, y: { initialValue: '' } },
    });
    b.restore(snap);
    expect(b.fields.x.value.value).toBe('hello');
    expect(b.fields.y.error.value).toBe('bad');
    expect(b.fields.y.isTouched.value).toBe(true);
  });

  it('toJSON returns current values', () => {
    const form = createForm({ fields: { x: { initialValue: 'hi' } } });
    expect(form.toJSON()).toEqual({ x: 'hi' });
  });

  it('toFormData produces a FormData with primitive coercion', () => {
    if (typeof FormData === 'undefined') return;
    const form = createForm({
      fields: {
        name: { initialValue: 'Ada' },
        active: { initialValue: true },
        offline: { initialValue: false },
        tags: { initialValue: ['a', 'b'] },
      },
    });
    const fd = form.toFormData();
    expect(fd.get('name')).toBe('Ada');
    expect(fd.get('active')).toBe('on');
    expect(fd.get('offline')).toBeNull();
    expect(fd.getAll('tags')).toEqual(['a', 'b']);
  });

  it('destroy disposes subscribers cleanly', () => {
    const form = createForm({ fields: { x: { initialValue: '' } } });
    expect(() => form.destroy()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createFieldArray
// ---------------------------------------------------------------------------

describe('forms/createFieldArray', () => {
  it('initializes with provided items', () => {
    const arr = createFieldArray<string>({
      initial: ['a', 'b'],
      factory: (value) => useFormField(value),
    });
    expect(arr.length.value).toBe(2);
    expect(arr.getValues()).toEqual(['a', 'b']);
  });

  it('supports add/insert/remove/move/clear', () => {
    const arr = createFieldArray<string>({
      initial: ['a', 'b'],
      factory: (value) => useFormField(value),
    });
    arr.add('c');
    expect(arr.getValues()).toEqual(['a', 'b', 'c']);
    arr.insert(0, 'z');
    expect(arr.getValues()).toEqual(['z', 'a', 'b', 'c']);
    arr.remove(1);
    expect(arr.getValues()).toEqual(['z', 'b', 'c']);
    arr.move(0, 2);
    expect(arr.getValues()).toEqual(['b', 'c', 'z']);
    arr.clear();
    expect(arr.length.value).toBe(0);
  });

  it('validate runs item-level and array-level validators', async () => {
    const arr = createFieldArray<string>({
      initial: ['ok', ''],
      factory: (value) => useFormField(value, { validators: [required('Req')] }),
      validators: [(items) => (items.length >= 2 ? true : 'Need at least 2')],
    });
    const ok = await arr.validate();
    expect(ok).toBe(false);
    // Item-level validator failed on the empty string
    expect(arr.items.peek()[1].error.value).toBe('Req');
  });

  it('reset returns the array to its initial items', () => {
    const arr = createFieldArray<string>({
      initial: ['a'],
      factory: (value) => useFormField(value),
    });
    arr.add('b');
    arr.reset();
    expect(arr.getValues()).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// schema builder
// ---------------------------------------------------------------------------

describe('forms/schema', () => {
  it('builds a field config from a fluent chain', async () => {
    const form = createForm({
      ...schema(
        {
          name: field<string>().required().minLength(2),
          age: field<number>().integer().between(0, 150),
        },
        { name: '', age: 0 }
      ),
    });
    await form.validate();
    expect(form.fields.name.error.value).toBe('This field is required');
    form.fields.name.value.value = 'A';
    form.fields.age.value.value = 200;
    await form.validate();
    expect(form.fields.name.error.value).toContain('at least');
    expect(form.fields.age.error.value).toContain('between');
  });

  it('accepts raw FieldConfig and plain initial values', async () => {
    const form = createForm({
      ...schema<{ a: string; b: number }>({
        a: { initialValue: 'x', validators: [required()] },
        b: 5,
      }),
    });
    expect(form.fields.a.value.value).toBe('x');
    expect(form.fields.b.value.value).toBe(5);
  });

  it('requires defaults for fluent schema entries', () => {
    expect(() =>
      schema<{ name: string }>({
        name: field<string>().required(),
      })
    ).toThrow('schema() requires a default value');
  });
});

// ---------------------------------------------------------------------------
// bindField / bindForm
// ---------------------------------------------------------------------------

describe('forms/bindField', () => {
  it('two-way binds a text input', () => {
    const form = createForm({ fields: { name: { initialValue: 'Ada' } } });
    const input = document.createElement('input');
    document.body.appendChild(input);
    const cleanup = bindField(form.fields.name, input);
    expect(input.value).toBe('Ada');
    input.value = 'Grace';
    input.dispatchEvent(new Event('input'));
    expect(form.fields.name.value.value).toBe('Grace');
    form.fields.name.value.value = 'Hopper';
    expect(input.value).toBe('Hopper');
    cleanup();
    input.remove();
  });

  it('binds a checkbox to a boolean field', () => {
    const form = createForm({ fields: { active: { initialValue: false } } });
    const input = document.createElement('input');
    input.type = 'checkbox';
    document.body.appendChild(input);
    const cleanup = bindField(form.fields.active, input);
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(form.fields.active.value.value).toBe(true);
    form.fields.active.value.value = false;
    expect(input.checked).toBe(false);
    cleanup();
    input.remove();
  });

  it('sets aria-invalid when error is present', () => {
    const form = createForm({ fields: { x: { initialValue: '' } } });
    const input = document.createElement('input');
    document.body.appendChild(input);
    const cleanup = bindField(form.fields.x, input);
    form.fields.x.setError('bad');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    form.fields.x.clearError();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    cleanup();
    input.remove();
  });

  it('disables the input when field.disabled is true', () => {
    const form = createForm({ fields: { x: { initialValue: '' } } });
    const input = document.createElement('input');
    document.body.appendChild(input);
    const cleanup = bindField(form.fields.x, input);
    form.fields.x.disabled.value = true;
    expect(input.disabled).toBe(true);
    cleanup();
    input.remove();
  });
});

describe('forms/bindForm', () => {
  it('auto-discovers inputs by name and wires submit', async () => {
    const form = createForm({
      fields: {
        name: { initialValue: '', validators: [required('Req')] },
        email: { initialValue: '' },
      },
      onSubmit: async () => {
        /* noop */
      },
    });
    const root = document.createElement('form');
    root.innerHTML = `
      <input name="name" />
      <span data-bq-error-for="name"></span>
      <input name="email" />
      <button type="submit">Save</button>
    `;
    document.body.appendChild(root);
    const cleanup = bindForm(form, root);

    const nameInput = root.querySelector('input[name="name"]') as HTMLInputElement;
    nameInput.value = 'Ada';
    nameInput.dispatchEvent(new Event('input'));
    expect(form.fields.name.value.value).toBe('Ada');

    form.fields.name.setError('Bad');
    const errSlot = root.querySelector('[data-bq-error-for="name"]')!;
    expect(errSlot.textContent).toBe('Bad');

    nameInput.value = '';
    nameInput.dispatchEvent(new Event('input'));
    root.dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 5));
    expect(form.submitCount.value).toBe(1);

    cleanup();
    root.remove();
  });
});

// ---------------------------------------------------------------------------
// SSR serialization
// ---------------------------------------------------------------------------

describe('forms/ssr', () => {
  it('serializeFormState produces a script tag and escapes payload', () => {
    const html = serializeFormState('register', {
      values: { x: '<script>alert(1)</script>' },
      errors: {},
      touched: {},
    });
    expect(html).toContain('data-bq-form="register"');
    // The inner <script> in the payload must be escaped to \u003c/\u003e
    expect(html).toContain('\\u003cscript\\u003e');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('readSerializedFormState parses a previously embedded payload', () => {
    document.body.innerHTML = serializeFormState('myid', {
      values: { x: 'hello' },
      errors: { x: 'oops' },
      touched: { x: true },
    });
    const snap = readSerializedFormState<{ x: string }>('myid');
    expect(snap?.values).toEqual({ x: 'hello' });
    expect(snap?.errors).toEqual({ x: 'oops' });
    document.body.innerHTML = '';
  });

  it('hydrateForm applies the snapshot to a matching form', () => {
    const form = createForm({ fields: { x: { initialValue: '' } } });
    document.body.innerHTML = serializeFormState('frm', {
      values: { x: 'restored' } as { x: string },
      errors: {},
      touched: { x: true },
    });
    expect(hydrateForm(form, 'frm')).toBe(true);
    expect(form.fields.x.value.value).toBe('restored');
    expect(form.fields.x.isTouched.value).toBe(true);
    document.body.innerHTML = '';
  });
});
