/**
 * Tests for the `forms` → Stable graduation work (#139):
 * - `createFieldArray()` stable-key contract validated with clear errors
 * - SSR serialization boundary (functions / File / Blob / bigint dropped)
 * - `validationStrategy` default contract (submit always validates)
 */
import { describe, expect, it } from 'bun:test';
import {
  createFieldArray,
  createForm,
  readSerializedFormState,
  required,
  serializeFormState,
  useFormField,
} from '../src/forms/index';
import type { FormSnapshot } from '../src/forms/index';

type Row = { id: string; text: string };

const rowField = (value: Row) => useFormField<Row>(value);

// ---------------------------------------------------------------------------
// #139 — createFieldArray stable-key contract
// ---------------------------------------------------------------------------

describe('forms/createFieldArray — stable-key contract', () => {
  it('is positional (unchanged) when no getKey is supplied', () => {
    const arr = createFieldArray<string>({
      initial: ['a', 'b'],
      factory: (value) => useFormField(value),
    });
    expect(arr.keys()).toEqual([]);
    expect(arr.keyAt(0)).toBeUndefined();
    expect(arr.getValues()).toEqual(['a', 'b']);
  });

  it('exposes keys()/keyAt() when getKey is supplied', () => {
    const arr = createFieldArray<Row>({
      initial: [
        { id: 'x', text: 'first' },
        { id: 'y', text: 'second' },
      ],
      factory: rowField,
      getKey: (value) => value.id,
    });
    expect(arr.keys()).toEqual(['x', 'y']);
    expect(arr.keyAt(0)).toBe('x');
    expect(arr.keyAt(1)).toBe('y');
    expect(arr.keyAt(5)).toBeUndefined();
  });

  it('throws a descriptive error for duplicate initial keys', () => {
    expect(() =>
      createFieldArray<Row>({
        initial: [
          { id: 'dup', text: 'a' },
          { id: 'dup', text: 'b' },
        ],
        factory: rowField,
        getKey: (value) => value.id,
      })
    ).toThrow(/stable, unique item keys.*"dup".*index 0.*index 1/s);
  });

  it('throws when add() would introduce a duplicate key', () => {
    const arr = createFieldArray<Row>({
      initial: [{ id: 'a', text: '1' }],
      factory: rowField,
      getKey: (value) => value.id,
    });
    expect(() => arr.add({ id: 'a', text: '2' })).toThrow(/unique item keys.*"a"/s);
    // the failed add did not mutate the array
    expect(arr.keys()).toEqual(['a']);
  });

  it('throws when insert() would introduce a duplicate key', () => {
    const arr = createFieldArray<Row>({
      initial: [{ id: 'a', text: '1' }],
      factory: rowField,
      getKey: (value) => value.id,
    });
    expect(() => arr.insert(0, { id: 'a', text: '2' })).toThrow(/unique item keys/);
    expect(arr.keys()).toEqual(['a']);
  });

  it('accepts non-colliding add()/insert() and keeps keys in order', () => {
    const arr = createFieldArray<Row>({
      initial: [{ id: 'a', text: '1' }],
      factory: rowField,
      getKey: (value) => value.id,
    });
    arr.add({ id: 'b', text: '2' });
    arr.insert(1, { id: 'c', text: '3' });
    expect(arr.keys()).toEqual(['a', 'c', 'b']);
  });

  it('rejects empty-string and NaN keys with a clear message', () => {
    expect(() =>
      createFieldArray<Row>({
        initial: [{ id: '', text: 'a' }],
        factory: rowField,
        getKey: (value) => value.id,
      })
    ).toThrow(/invalid key.*non-empty string or a finite number/s);

    expect(() =>
      createFieldArray<{ k: number }>({
        initial: [{ k: Number.NaN }],
        factory: (value) => useFormField(value),
        getKey: (value) => value.k,
      })
    ).toThrow(/invalid key/);
  });

  it('re-validates keys after reset()', () => {
    const arr = createFieldArray<Row>({
      initial: [{ id: 'a', text: '1' }],
      factory: rowField,
      getKey: (value) => value.id,
    });
    arr.add({ id: 'b', text: '2' });
    expect(arr.keys()).toEqual(['a', 'b']);
    arr.reset();
    expect(arr.keys()).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// #139 — SSR serialization boundary
// ---------------------------------------------------------------------------

describe('forms/serializeFormState — serialization boundary', () => {
  const roundTrip = <T extends Record<string, unknown>>(snapshot: FormSnapshot<T>) => {
    document.body.innerHTML = serializeFormState('boundary', snapshot);
    return readSerializedFormState<T>('boundary');
  };

  it('keeps plain JSON values', () => {
    const decoded = roundTrip({
      values: { name: 'Ada', age: 36, active: true, tags: ['x', 'y'] },
      errors: { name: 'oops' },
      touched: { name: true },
    });
    expect(decoded?.values).toEqual({ name: 'Ada', age: 36, active: true, tags: ['x', 'y'] });
    expect(decoded?.errors).toEqual({ name: 'oops' });
    expect(decoded?.touched).toEqual({ name: true });
  });

  it('drops functions, File/Blob handles, and bigint as a guaranteed boundary', () => {
    const decoded = roundTrip({
      values: {
        name: 'Ada',
        avatar: new File(['data'], 'avatar.png', { type: 'image/png' }),
        blob: new Blob(['x']),
        handler: () => 'nope',
        huge: 10n,
      },
      errors: {},
      touched: {},
    } as unknown as FormSnapshot<Record<string, unknown>>);

    expect(decoded?.values.name).toBe('Ada');
    expect('avatar' in (decoded?.values ?? {})).toBe(false);
    expect('blob' in (decoded?.values ?? {})).toBe(false);
    expect('handler' in (decoded?.values ?? {})).toBe(false);
    expect('huge' in (decoded?.values ?? {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #139 — validationStrategy default contract
// ---------------------------------------------------------------------------

describe('forms/validationStrategy — documented default contract', () => {
  it("default 'manual' does NOT auto-validate on change, but submit always does", async () => {
    let submitted = 0;
    const form = createForm<{ name: string }>({
      fields: { name: { initialValue: '', validators: [required('Name required')] } },
      onSubmit: () => {
        submitted += 1;
      },
    });

    // typing an invalid value does not surface an error automatically
    form.fields.name.value.value = '';
    await Promise.resolve();
    expect(form.errors.name.value).toBe('');

    // submit runs the full validation pass regardless of strategy
    await form.handleSubmit();
    expect(form.errors.name.value).toBe('Name required');
    expect(submitted).toBe(0); // invalid → onSubmit skipped

    form.fields.name.value.value = 'Ada';
    await form.handleSubmit();
    expect(form.errors.name.value).toBe('');
    expect(submitted).toBe(1);
  });

  it("'onChange' strategy auto-validates on every change", async () => {
    const form = createForm<{ name: string }>({
      fields: { name: { initialValue: 'Ada', validators: [required('Name required')] } },
      validationStrategy: 'onChange',
    });

    form.fields.name.value.value = '';
    await Promise.resolve();
    await Promise.resolve();
    expect(form.errors.name.value).toBe('Name required');
  });
});
