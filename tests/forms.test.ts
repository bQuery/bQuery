import { describe, expect, it } from 'bun:test';
import {
  createForm,
  custom,
  customAsync,
  email,
  matchField,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  useFormField,
  url,
} from '../src/forms/index';
import { computed, effect, readonly, signal } from '../src/reactive/index';

const expectType = <T>(_value: T): void => {};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

describe('forms/validators', () => {
  describe('required', () => {
    const validate = required();

    it('fails for null and undefined', () => {
      expect(validate(null)).toBe('This field is required');
      expect(validate(undefined)).toBe('This field is required');
    });

    it('fails for empty string', () => {
      expect(validate('')).toBe('This field is required');
    });

    it('fails for whitespace-only string', () => {
      expect(validate('   ')).toBe('This field is required');
    });

    it('fails for empty array', () => {
      expect(validate([])).toBe('This field is required');
    });

    it('passes for non-empty string', () => {
      expect(validate('hello')).toBe(true);
    });

    it('passes for non-empty array', () => {
      expect(validate([1])).toBe(true);
    });

    it('passes for zero', () => {
      expect(validate(0)).toBe(true);
    });

    it('passes for false', () => {
      expect(validate(false)).toBe(true);
    });

    it('uses custom message', () => {
      const v = required('Name needed');
      expect(v('')).toBe('Name needed');
    });
  });

  describe('minLength', () => {
    const validate = minLength(3);

    it('fails for short strings', () => {
      expect(validate('ab')).toBe('Must be at least 3 characters');
    });

    it('passes for exact length', () => {
      expect(validate('abc')).toBe(true);
    });

    it('passes for longer strings', () => {
      expect(validate('abcd')).toBe(true);
    });

    it('uses custom message', () => {
      const v = minLength(5, 'Too short');
      expect(v('abc')).toBe('Too short');
    });

    it('handles non-string values via coercion', () => {
      expect(minLength(1)(123)).toBe(true);
    });
  });

  describe('maxLength', () => {
    const validate = maxLength(5);

    it('fails for long strings', () => {
      expect(validate('toolong')).toBe('Must be at most 5 characters');
    });

    it('passes for exact length', () => {
      expect(validate('exact')).toBe(true);
    });

    it('passes for shorter strings', () => {
      expect(validate('ok')).toBe(true);
    });

    it('uses custom message', () => {
      const v = maxLength(3, 'Too long');
      expect(v('abcd')).toBe('Too long');
    });

    it('handles non-string values via coercion', () => {
      expect(maxLength(4)(1234)).toBe(true);
    });
  });

  describe('pattern', () => {
    const validate = pattern(/^\d+$/);

    it('fails for non-matching', () => {
      expect(validate('abc')).toBe('Invalid format');
    });

    it('passes for matching', () => {
      expect(validate('123')).toBe(true);
    });

    it('uses custom message', () => {
      const v = pattern(/^[A-Z]+$/, 'Uppercase only');
      expect(v('abc')).toBe('Uppercase only');
    });

    it('does not alternate results for global regex patterns', () => {
      const v = pattern(/\d+/g, 'Numbers only');
      expect(v('123')).toBe(true);
      expect(v('123')).toBe(true);
      expect(v('abc')).toBe('Numbers only');
      expect(v('123')).toBe(true);
    });

    it('coerces non-string values before testing the pattern', () => {
      expect(pattern(/^\d+$/)(123)).toBe(true);
    });
  });

  describe('email', () => {
    const validate = email();

    it('fails for invalid email', () => {
      expect(validate('nope')).toBe('Invalid email address');
    });

    it('fails for email without domain', () => {
      expect(validate('ada@lovelace')).toBe('Invalid email address');
    });

    it('passes for valid email', () => {
      expect(validate('ada@love.co')).toBe(true);
    });

    it('passes for empty string (use required for non-empty)', () => {
      expect(validate('')).toBe(true);
    });

    it('uses custom message', () => {
      const v = email('Bad email');
      expect(v('bad')).toBe('Bad email');
    });
  });

  describe('url', () => {
    const validate = url();

    it('fails for non-URL', () => {
      expect(validate('not-a-url')).toBe('Invalid URL');
    });

    it('passes for valid URL', () => {
      expect(validate('https://example.com')).toBe(true);
    });

    it('passes for empty string', () => {
      expect(validate('')).toBe(true);
    });

    it('uses custom message', () => {
      const v = url('Bad URL');
      expect(v('nope')).toBe('Bad URL');
    });
  });

  describe('min', () => {
    const validate = min(5);

    it('fails for lower values', () => {
      expect(validate(4)).toBe('Must be at least 5');
    });

    it('passes for exact value', () => {
      expect(validate(5)).toBe(true);
    });

    it('passes for higher values', () => {
      expect(validate(100)).toBe(true);
    });

    it('uses custom message', () => {
      const v = min(1, 'Positive only');
      expect(v(0)).toBe('Positive only');
    });

    it('coerces non-number values before comparison', () => {
      expect(min(5)('6')).toBe(true);
    });

    it('treats empty-ish values as valid so required() handles presence', () => {
      expect(validate('')).toBe(true);
      expect(validate('   ')).toBe(true);
      expect(validate(null)).toBe(true);
      expect(validate(undefined)).toBe(true);
    });
  });

  describe('max', () => {
    const validate = max(100);

    it('fails for higher values', () => {
      expect(validate(101)).toBe('Must be at most 100');
    });

    it('passes for exact value', () => {
      expect(validate(100)).toBe(true);
    });

    it('passes for lower values', () => {
      expect(validate(50)).toBe(true);
    });

    it('uses custom message', () => {
      const v = max(10, 'Too much');
      expect(v(11)).toBe('Too much');
    });

    it('coerces non-number values before comparison', () => {
      expect(max(10)('9')).toBe(true);
    });

    it('treats empty-ish values as valid so required() handles presence', () => {
      expect(validate('')).toBe(true);
      expect(validate('   ')).toBe(true);
      expect(validate(null)).toBe(true);
      expect(validate(undefined)).toBe(true);
    });
  });

  describe('custom', () => {
    it('returns true when predicate passes', () => {
      const isEven = custom((v: number) => v % 2 === 0, 'Must be even');
      expect(isEven(4)).toBe(true);
    });

    it('returns message when predicate fails', () => {
      const isEven = custom((v: number) => v % 2 === 0, 'Must be even');
      expect(isEven(3)).toBe('Must be even');
    });
  });

  describe('customAsync', () => {
    it('resolves true when async predicate passes', async () => {
      const v = customAsync(async (val: string) => val === 'ok', 'Not ok');
      expect(await v('ok')).toBe(true);
    });

    it('resolves message when async predicate fails', async () => {
      const v = customAsync(async (val: string) => val === 'ok', 'Not ok');
      expect(await v('bad')).toBe('Not ok');
    });
  });
});

// ---------------------------------------------------------------------------
// createForm
// ---------------------------------------------------------------------------

describe('forms/createForm', () => {
  describe('basic creation', () => {
    it('creates a form with initial values', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
          age: { initialValue: 0 },
        },
      });

      expect(form.fields.name.value.value).toBe('');
      expect(form.fields.age.value.value).toBe(0);
    });

    it('provides error signals for each field', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      expect(form.errors.name.value).toBe('');
    });

    it('starts not dirty', () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'Ada' },
        },
      });

      expect(form.isDirty.value).toBe(false);
      expect(form.fields.name.isDirty.value).toBe(false);
    });

    it('starts not touched', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      expect(form.fields.name.isTouched.value).toBe(false);
    });

    it('starts pristine', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      expect(form.fields.name.isPristine.value).toBe(true);
    });

    it('starts not submitting', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      expect(form.isSubmitting.value).toBe(false);
    });

    it('isValid starts true when no validators', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      expect(form.isValid.value).toBe(true);
    });
  });

  describe('dirty/touched tracking', () => {
    it('becomes dirty when a field value changes', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      form.fields.name.value.value = 'Ada';
      expect(form.fields.name.isDirty.value).toBe(true);
      expect(form.fields.name.isPristine.value).toBe(false);
      expect(form.isDirty.value).toBe(true);
    });

    it('reverts to not dirty when value matches initial', () => {
      const form = createForm({
        fields: { name: { initialValue: 'Ada' } },
      });

      form.fields.name.value.value = 'Babbage';
      expect(form.isDirty.value).toBe(true);

      form.fields.name.value.value = 'Ada';
      expect(form.isDirty.value).toBe(false);
    });

    it('tracks touched via touch()', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      expect(form.fields.name.isTouched.value).toBe(false);
      form.fields.name.touch();
      expect(form.fields.name.isTouched.value).toBe(true);
    });
  });

  describe('field-level validation', () => {
    it('validates a single field', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required('Required')] },
        },
      });

      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('Required');
      expect(form.isValid.value).toBe(false);
    });

    it('clears error when field becomes valid', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required()] },
        },
      });

      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('This field is required');

      form.fields.name.value.value = 'Ada';
      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('');
      expect(form.isValid.value).toBe(true);
    });

    it('stops at first failing validator', async () => {
      const form = createForm({
        fields: {
          name: {
            initialValue: '',
            validators: [required('Required'), minLength(3, 'Too short')],
          },
        },
      });

      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('Required');
    });

    it('runs second validator when first passes', async () => {
      const form = createForm({
        fields: {
          name: {
            initialValue: 'ab',
            validators: [required('Required'), minLength(3, 'Too short')],
          },
        },
      });

      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('Too short');
    });

    it('handles async validators', async () => {
      const asyncCheck = customAsync(async (val: string) => val !== 'taken', 'Already taken');

      const form = createForm({
        fields: {
          username: {
            initialValue: 'taken',
            validators: [asyncCheck],
          },
        },
      });

      await form.validateField('username');
      expect(form.fields.username.error.value).toBe('Already taken');

      form.fields.username.value.value = 'available';
      await form.validateField('username');
      expect(form.fields.username.error.value).toBe('');
    });

    it('handles thenable validators like async validators', async () => {
      const form = createForm({
        fields: {
          username: {
            initialValue: 'taken',
            validators: [
              ((value: string) =>
                ({
                  then: (resolve: (result: string | true) => void) => {
                    resolve(value === 'taken' ? 'Already taken' : true);
                  },
                }) as Promise<string | true>) as never,
            ],
          },
        },
      });

      await form.validateField('username');
      expect(form.fields.username.error.value).toBe('Already taken');

      form.fields.username.value.value = 'available';
      await form.validateField('username');
      expect(form.fields.username.error.value).toBe('');
    });

    it('handles field without validators', async () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      await form.validateField('name');
      expect(form.fields.name.error.value).toBe('');
    });

    it('handles unknown field name gracefully', async () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      // Should not throw
      await form.validateField('nonexistent' as 'name');
    });
  });

  describe('form-level validation', () => {
    it('validates all fields at once', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required('Name required')] },
          email: { initialValue: '', validators: [required('Email required')] },
        },
      });

      const valid = await form.validate();
      expect(valid).toBe(false);
      expect(form.fields.name.error.value).toBe('Name required');
      expect(form.fields.email.error.value).toBe('Email required');
    });

    it('returns true when all fields are valid', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'Ada', validators: [required()] },
          email: { initialValue: 'ada@love.co', validators: [required(), email()] },
        },
      });

      const valid = await form.validate();
      expect(valid).toBe(true);
    });
  });

  describe('cross-field validation', () => {
    it('runs cross-field validators after per-field validation', async () => {
      const form = createForm({
        fields: {
          password: { initialValue: 'secret123', validators: [required()] },
          confirmPassword: { initialValue: 'different', validators: [required()] },
        },
        crossValidators: [
          (values) => {
            if (values.password !== values.confirmPassword) {
              return { confirmPassword: 'Passwords do not match' };
            }
            return undefined;
          },
        ],
      });

      const valid = await form.validate();
      expect(valid).toBe(false);
      expect(form.fields.confirmPassword.error.value).toBe('Passwords do not match');
    });

    it('does not overwrite per-field errors with cross-field errors', async () => {
      const form = createForm({
        fields: {
          password: { initialValue: '', validators: [required('Password required')] },
          confirmPassword: { initialValue: '', validators: [required('Confirm required')] },
        },
        crossValidators: [
          (values) => {
            if (values.password !== values.confirmPassword) {
              return { confirmPassword: 'Passwords do not match' };
            }
            return undefined;
          },
        ],
      });

      const valid = await form.validate();
      expect(valid).toBe(false);
      // Per-field error takes priority over cross-field error
      expect(form.fields.confirmPassword.error.value).toBe('Confirm required');
    });

    it('passes when cross-field validators return undefined', async () => {
      const form = createForm({
        fields: {
          password: { initialValue: 'match', validators: [required()] },
          confirmPassword: { initialValue: 'match', validators: [required()] },
        },
        crossValidators: [
          (values) => {
            if (values.password !== values.confirmPassword) {
              return { confirmPassword: 'Passwords do not match' };
            }
            return undefined;
          },
        ],
      });

      const valid = await form.validate();
      expect(valid).toBe(true);
    });

    it('supports async cross-field validators', async () => {
      const form = createForm({
        fields: {
          start: { initialValue: 1 },
          end: { initialValue: 0 },
        },
        crossValidators: [
          async (values) => {
            if (values.start >= values.end) {
              return { end: 'End must be after start' };
            }
            return undefined;
          },
        ],
      });

      const valid = await form.validate();
      expect(valid).toBe(false);
      expect(form.fields.end.error.value).toBe('End must be after start');
    });
  });

  describe('handleSubmit', () => {
    it('validates before calling onSubmit', async () => {
      let submitted = false;

      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required()] },
        },
        onSubmit: () => {
          submitted = true;
        },
      });

      await form.handleSubmit();
      expect(submitted).toBe(false);
      expect(form.fields.name.error.value).toBe('This field is required');
    });

    it('calls onSubmit when form is valid', async () => {
      let received: unknown = null;

      const form = createForm({
        fields: {
          name: { initialValue: 'Ada', validators: [required()] },
        },
        onSubmit: (values) => {
          received = values;
        },
      });

      await form.handleSubmit();
      expect(received).not.toBeNull();
      expect(received).toEqual({ name: 'Ada' });
    });

    it('sets isSubmitting during async submission', async () => {
      const states: boolean[] = [];
      let resolveSubmit: (() => void) | undefined;

      const form = createForm({
        fields: { name: { initialValue: 'Ada' } },
        onSubmit: () => {
          // Capture state inside the handler — must be true here
          states.push(form.isSubmitting.value);
          return new Promise<void>((resolve) => {
            resolveSubmit = resolve;
          });
        },
      });

      // isSubmitting becomes true synchronously
      const submitPromise = form.handleSubmit();
      states.push(form.isSubmitting.value);

      // Wait for validation to complete and onSubmit to be called
      await new Promise<void>((r) => queueMicrotask(r));
      // Resolve the onSubmit promise
      resolveSubmit?.();
      await submitPromise;
      states.push(form.isSubmitting.value);

      // [true (sync after call), true (inside onSubmit), false (after complete)]
      expect(states).toEqual([true, true, false]);
    });

    it('resets isSubmitting even if onSubmit throws', async () => {
      const form = createForm({
        fields: { name: { initialValue: 'Ada' } },
        onSubmit: () => {
          throw new Error('Submission failed');
        },
      });

      try {
        await form.handleSubmit();
      } catch {
        // expected
      }

      expect(form.isSubmitting.value).toBe(false);
    });

    it('prevents concurrent submissions', async () => {
      let callCount = 0;

      const form = createForm({
        fields: { name: { initialValue: 'Ada' } },
        onSubmit: async () => {
          callCount++;
          await new Promise((r) => setTimeout(r, 50));
        },
      });

      // Start two concurrent submissions
      const p1 = form.handleSubmit();
      const p2 = form.handleSubmit();
      await Promise.all([p1, p2]);

      expect(callCount).toBe(1);
    });

    it('works without onSubmit handler', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'Ada', validators: [required()] },
        },
      });

      // Should not throw
      await form.handleSubmit();
    });
  });

  describe('reset', () => {
    it('resets all field values to initial', () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'Ada' },
          age: { initialValue: 36 },
        },
      });

      form.fields.name.value.value = 'Babbage';
      form.fields.age.value.value = 79;

      form.reset();

      expect(form.fields.name.value.value).toBe('Ada');
      expect(form.fields.age.value.value).toBe(36);
    });

    it('clears all errors', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required('Required')] },
        },
      });

      await form.validate();
      expect(form.fields.name.error.value).toBe('Required');

      form.reset();
      expect(form.fields.name.error.value).toBe('');
    });

    it('resets dirty and touched flags', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      form.fields.name.value.value = 'Ada';
      form.fields.name.touch();

      expect(form.isDirty.value).toBe(true);
      expect(form.fields.name.isTouched.value).toBe(true);

      form.reset();

      expect(form.isDirty.value).toBe(false);
      expect(form.fields.name.isTouched.value).toBe(false);
      expect(form.fields.name.isPristine.value).toBe(true);
    });
  });

  describe('getValues', () => {
    it('returns a snapshot of current field values', () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'Ada' },
          age: { initialValue: 36 },
        },
      });

      expect(form.getValues()).toEqual({ name: 'Ada', age: 36 });
    });

    it('reflects changed values', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      form.fields.name.value.value = 'Ada';
      expect(form.getValues()).toEqual({ name: 'Ada' });
    });
  });

  describe('reactivity integration', () => {
    it('isValid reacts to error signal changes', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [required()] },
        },
      });

      const validStates: boolean[] = [];
      const cleanup = effect(() => {
        validStates.push(form.isValid.value);
      });

      await form.validate();
      form.fields.name.value.value = 'Ada';
      await form.validate();

      cleanup();
      // [true (initial), false (after validate), true (after fix+validate)]
      expect(validStates).toEqual([true, false, true]);
    });

    it('isDirty reacts to value changes', () => {
      const form = createForm({
        fields: { name: { initialValue: '' } },
      });

      const dirtyStates: boolean[] = [];
      const cleanup = effect(() => {
        dirtyStates.push(form.isDirty.value);
      });

      form.fields.name.value.value = 'Ada';
      form.fields.name.value.value = '';

      cleanup();
      expect(dirtyStates).toEqual([false, true, false]);
    });
  });

  describe('edge cases', () => {
    it('handles a form with no fields', () => {
      const form = createForm({
        fields: {} as Record<string, never>,
      });

      expect(form.isValid.value).toBe(true);
      expect(form.isDirty.value).toBe(false);
      expect(form.getValues()).toEqual({});
    });

    it('handles field with empty validators array', async () => {
      const form = createForm({
        fields: {
          name: { initialValue: '', validators: [] },
        },
      });

      await form.validate();
      expect(form.fields.name.error.value).toBe('');
      expect(form.isValid.value).toBe(true);
    });

    it('per-field reset does not affect other fields', () => {
      const form = createForm({
        fields: {
          first: { initialValue: 'A' },
          second: { initialValue: 'B' },
        },
      });

      form.fields.first.value.value = 'X';
      form.fields.second.value.value = 'Y';

      form.fields.first.reset();

      expect(form.fields.first.value.value).toBe('A');
      expect(form.fields.second.value.value).toBe('Y');
    });
  });

  // -------------------------------------------------------------------------
  // setValues
  // -------------------------------------------------------------------------

  describe('setValues', () => {
    it('bulk-sets field values from a partial object', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
          age: { initialValue: 0 },
          email: { initialValue: '' },
        },
      });

      form.setValues({ name: 'Ada', age: 30 });

      expect(form.fields.name.value.value).toBe('Ada');
      expect(form.fields.age.value.value).toBe(30);
      expect(form.fields.email.value.value).toBe(''); // unchanged
    });

    it('marks affected fields as dirty', () => {
      const form = createForm({
        fields: {
          first: { initialValue: 'A' },
          second: { initialValue: 'B' },
        },
      });

      form.setValues({ first: 'X' });

      expect(form.fields.first.isDirty.value).toBe(true);
      expect(form.fields.second.isDirty.value).toBe(false);
      expect(form.isDirty.value).toBe(true);
    });

    it('ignores unknown field names', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      // Should not throw
      form.setValues({ name: 'Ada', unknownField: 'ignored' } as Record<string, unknown>);

      expect(form.fields.name.value.value).toBe('Ada');
    });

    it('handles empty object', () => {
      const form = createForm({
        fields: {
          name: { initialValue: 'test' },
        },
      });

      form.setValues({});
      expect(form.fields.name.value.value).toBe('test');
    });

    it('ignores prototype pollution keys', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });
      const values = { name: 'Ada' } as Record<string, unknown>;

      Object.defineProperty(values, '__proto__', { value: {}, enumerable: true });
      Object.defineProperty(values, 'constructor', { value: {}, enumerable: true });
      Object.defineProperty(values, 'prototype', { value: {}, enumerable: true });

      expect(() => form.setValues(values)).not.toThrow();
      expect(form.fields.name.value.value).toBe('Ada');
    });
  });

  // -------------------------------------------------------------------------
  // setErrors
  // -------------------------------------------------------------------------

  describe('setErrors', () => {
    it('bulk-sets error messages on specific fields', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
          email: { initialValue: '' },
          age: { initialValue: 0 },
        },
      });

      form.setErrors({ name: 'Name is required', email: 'Invalid email' });

      expect(form.fields.name.error.value).toBe('Name is required');
      expect(form.fields.email.error.value).toBe('Invalid email');
      expect(form.fields.age.error.value).toBe(''); // untouched
    });

    it('makes isValid reflect the errors', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      form.setErrors({ name: 'Required' });
      expect(form.isValid.value).toBe(false);

      form.setErrors({ name: '' });
      expect(form.isValid.value).toBe(true);
    });

    it('ignores unknown field names', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      // Should not throw
      form.setErrors({ name: 'Error', unknown: 'ignored' } as Record<string, string>);
      expect(form.fields.name.error.value).toBe('Error');
    });

    it('handles empty error map', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });

      form.setErrors({ name: 'Error' });
      form.setErrors({});
      expect(form.fields.name.error.value).toBe('Error'); // unchanged
    });

    it('ignores prototype pollution keys', () => {
      const form = createForm({
        fields: {
          name: { initialValue: '' },
        },
      });
      const errors = Object.create(null) as Record<string, string>;
      errors.name = 'Required';
      Object.defineProperty(errors, '__proto__', { value: 'ignored', enumerable: true });
      Object.defineProperty(errors, 'constructor', { value: 'ignored', enumerable: true });
      Object.defineProperty(errors, 'prototype', { value: 'ignored', enumerable: true });

      expect(() => form.setErrors(errors)).not.toThrow();
      expect(form.fields.name.error.value).toBe('Required');
    });
  });
});

// ---------------------------------------------------------------------------
// useFormField
// ---------------------------------------------------------------------------

describe('forms/useFormField', () => {
  it('creates standalone reactive field state from a plain value', () => {
    const field = useFormField('Ada');

    expect(field.value.value).toBe('Ada');
    expect(field.error.value).toBe('');
    expect(field.isDirty.value).toBe(false);
    expect(field.isPristine.value).toBe(true);
    expect(field.isTouched.value).toBe(false);
    expect(field.isValid.value).toBe(true);
    expect(field.isValidating.value).toBe(false);
  });

  it('reuses an external signal when provided', () => {
    const value = signal('Ada');
    const field = useFormField(value);

    expect(field.value).toBe(value);

    field.value.value = 'Grace';
    expect(value.value).toBe('Grace');
    expect(field.isDirty.value).toBe(true);
  });

  it('does not treat computed values as writable external signals', () => {
    const source = signal('Ada');
    const readonlyValue = computed(() => source.value);
    const field = useFormField(readonlyValue);

    expectType<string>(field.value.value);

    expect(field.value).not.toBe(readonlyValue);
    expect(field.value.value).toBe('Ada');

    expect(() => field.reset()).not.toThrow();
  });

  it('snapshots computed values without subscribing the active observer', () => {
    const source = signal('Ada');
    const readonlyValue = computed(() => source.value);
    let runs = 0;

    const stop = effect(() => {
      const field = useFormField(readonlyValue);
      expectType<string>(field.value.value);
      runs++;
    });

    expect(runs).toBe(1);

    source.value = 'Grace';
    expect(runs).toBe(1);

    stop();
  });

  it('snapshots readonly signal wrappers without reusing them as writable field state', () => {
    const source = signal('Ada');
    const readonlyValue = readonly(source);
    const field = useFormField(readonlyValue);

    expectType<string>(field.value.value);
    expect(field.value.value).toBe('Ada');
    expect(field.value).not.toBe(readonlyValue);

    expect(() => field.reset()).not.toThrow();
  });

  it('validates manually by default', async () => {
    const field = useFormField('', {
      validators: [required('Required')],
    });

    field.value.value = '';
    expect(field.error.value).toBe('');

    await field.validate();
    expect(field.error.value).toBe('Required');
    expect(field.isValid.value).toBe(false);
  });

  it('validates on change when configured', async () => {
    const field = useFormField<string>('Ada', {
      validators: [required('Required')],
      validateOn: 'change',
    });

    field.value.value = '';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('Required');

    field.value.value = 'Ada';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('');
  });

  it('validates on blur when configured', async () => {
    const field = useFormField<string>('', {
      validators: [required('Required')],
      validateOn: 'blur',
    });

    field.value.value = '';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('');

    field.touch();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.isTouched.value).toBe(true);
    expect(field.error.value).toBe('Required');
  });

  it('validates on both change and blur when configured', async () => {
    const field = useFormField<string>('Ada', {
      validators: [required('Required')],
      validateOn: 'both',
    });

    field.value.value = '';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('Required');

    field.value.value = 'Ada';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('');

    field.value.value = '';
    field.touch();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.error.value).toBe('Required');
  });

  it('supports debounced automatic validation', async () => {
    const field = useFormField<string>('Ada', {
      validators: [required('Required')],
      validateOn: 'change',
      debounceMs: 20,
    });

    field.value.value = '';
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(field.error.value).toBe('');

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(field.error.value).toBe('Required');
  });

  it('resets pending debounce, touched state, and errors', async () => {
    const field = useFormField<string>('', {
      validators: [required('Required')],
      validateOn: 'change',
      debounceMs: 20,
      initialError: 'Initial',
    });

    field.value.value = 'Ada';
    field.touch();
    field.reset();

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(field.value.value).toBe('');
    expect(field.isTouched.value).toBe(false);
    expect(field.error.value).toBe('Initial');
    expect(field.isValidating.value).toBe(false);
  });

  it('ignores stale async validation results', async () => {
    const field = useFormField<string>('', {
      validators: [
        customAsync(async (value: string) => {
          if (value === 'slow') {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return false;
          }

          await new Promise((resolve) => setTimeout(resolve, 0));
          return true;
        }, 'Taken'),
      ],
      validateOn: 'change',
    });

    field.value.value = 'slow';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(field.isValidating.value).toBe(true);

    field.value.value = 'fast';
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(field.error.value).toBe('');
    expect(field.isValid.value).toBe(true);
    expect(field.isValidating.value).toBe(false);
  });

  it('catches scheduled validation rejections and clears isValidating', async () => {
    const field = useFormField<string>('Ada', {
      validators: [
        async () => {
          throw new Error('validator failed');
        },
      ],
      validateOn: 'change',
    });
    const loggedMessages: string[] = [];
    const originalError = console.error;

    try {
      console.error = (message: string) => loggedMessages.push(message);

      field.value.value = 'Grace';
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(field.isValidating.value).toBe(false);
      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain('Error in scheduled field validation');
    } finally {
      console.error = originalError;
    }
  });

  it('destroy cancels automatic validation timers and subscriptions', async () => {
    const field = useFormField<string>('Ada', {
      validators: [required('Required')],
      validateOn: 'both',
      debounceMs: 20,
    });

    field.value.value = '';
    field.destroy();

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(field.error.value).toBe('');

    field.touch();
    field.value.value = 'Grace';
    field.value.value = '';

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(field.error.value).toBe('');
    expect(field.isValidating.value).toBe(false);
  });

  it('destroy disposes internal computed state subscriptions', () => {
    const value = signal('Ada');
    const field = useFormField(value);
    const valueSubscribers = value as unknown as { subscribers: Set<() => void> };
    const errorSubscribers = field.error as unknown as { subscribers: Set<() => void> };
    const dirtySubscribers = field.isDirty as unknown as { subscribers: Set<() => void> };

    void field.isDirty.value;
    void field.isPristine.value;
    void field.isValid.value;

    expect(valueSubscribers.subscribers.size).toBe(1);
    expect(errorSubscribers.subscribers.size).toBe(1);
    expect(dirtySubscribers.subscribers.size).toBe(1);

    field.destroy();

    expect(valueSubscribers.subscribers.size).toBe(0);
    expect(errorSubscribers.subscribers.size).toBe(0);
    expect(dirtySubscribers.subscribers.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// matchField validator
// ---------------------------------------------------------------------------

describe('forms/matchField', () => {
  it('passes when values match', () => {
    const ref = signal('secret');
    const validate = matchField(ref);

    expectType<string | true | undefined>(validate('secret'));
    expect(validate('secret')).toBe(true);
  });

  it('fails when values do not match', () => {
    const ref = signal('secret');
    const validate = matchField(ref);

    expect(validate('wrong')).toBe('Fields do not match');
  });

  it('uses custom error message', () => {
    const ref = signal('abc');
    const validate = matchField(ref, 'Passwords must match');

    expect(validate('xyz')).toBe('Passwords must match');
  });

  it('tracks reactive changes in the reference signal', () => {
    const ref = signal('first');
    const validate = matchField(ref);

    expect(validate('first')).toBe(true);
    ref.value = 'second';
    expect(validate('first')).toBe('Fields do not match');
    expect(validate('second')).toBe(true);
  });

  it('uses Object.is comparison (handles NaN)', () => {
    const ref = signal(NaN);
    const validate = matchField(ref);

    expect(validate(NaN)).toBe(true);
    expect(validate(0)).toBe('Fields do not match');
  });

  it('handles null and undefined', () => {
    const ref = signal<unknown>(null);
    const validate = matchField(ref);

    expect(validate(null)).toBe(true);
    expect(validate(undefined)).toBe('Fields do not match');
  });

  it('works with plain object references', () => {
    const ref = { value: 'test' };
    const validate = matchField(ref);

    expect(validate('test')).toBe(true);
    expect(validate('other')).toBe('Fields do not match');
  });

  it('preserves the reference value type in the validator signature', () => {
    const ref = signal('secret');
    const validate = matchField(ref);

    expectType<string | true | undefined>(validate('secret'));

    // @ts-expect-error matchField validator should require the same value type as ref
    validate(123);
  });
});
