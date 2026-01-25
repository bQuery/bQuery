/**
 * Type guards for reactive primitives.
 */

import { Computed } from './computed';
import { Signal } from './core';

/**
 * Type guard to check if a value is a Signal instance.
 *
 * @param value - The value to check
 * @returns True if the value is a Signal
 */
export const isSignal = (value: unknown): value is Signal<unknown> => value instanceof Signal;

/**
 * Type guard to check if a value is a Computed instance.
 *
 * @param value - The value to check
 * @returns True if the value is a Computed
 */
export const isComputed = (value: unknown): value is Computed<unknown> => value instanceof Computed;
