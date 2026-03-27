import { describe, expect, it } from 'bun:test';
import {
  createForm,
  custom,
  customAsync,
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  url,
} from '../src/forms/index';
import { effect } from '../src/reactive/index';

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
});
