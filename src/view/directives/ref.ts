import { isSignal, type Signal } from '../../reactive/index';
import { evaluateRaw } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Checks if an object has a writable `value` property.
 * Returns true if `value` is an own data property or an accessor with a setter.
 * @internal
 */
function hasWritableValue(obj: object): obj is { value: Element | null } {
  const descriptor = Object.getOwnPropertyDescriptor(obj, 'value');
  if (!descriptor) return false;
  // Data property: check writable flag
  if ('value' in descriptor) return descriptor.writable === true;
  // Accessor property: check for setter
  return typeof descriptor.set === 'function';
}

/**
 * Handles bq-ref directive - element reference.
 * @internal
 */
export const handleRef: DirectiveHandler = (el, expression, context, cleanups) => {
  const rawValue = evaluateRaw<Signal<Element | null> | { value: Element | null }>(
    expression,
    context
  );

  if (isSignal(rawValue)) {
    rawValue.value = el;
    cleanups.push(() => {
      rawValue.value = null;
    });
  } else if (typeof rawValue === 'object' && rawValue !== null && hasWritableValue(rawValue)) {
    // Object with writable .value property (e.g., { value: null })
    rawValue.value = el;
    cleanups.push(() => {
      rawValue.value = null;
    });
  }
};
