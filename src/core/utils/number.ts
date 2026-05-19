/**
 * Number-focused utility helpers.
 *
 * @module bquery/core/utils/number
 */

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns A random integer in the range [min, max]
 *
 * @example
 * ```ts
 * const roll = randomInt(1, 6); // Random dice roll
 * ```
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Clamps a number between a minimum and maximum value.
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns The clamped value
 *
 * @example
 * ```ts
 * clamp(150, 0, 100); // 100
 * clamp(-10, 0, 100); // 0
 * clamp(50, 0, 100);  // 50
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Checks if a number is within a range.
 *
 * @param value - The value to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @param inclusive - Whether the range is inclusive (default: true)
 * @returns True if the value is within the range
 *
 * @example
 * ```ts
 * inRange(5, 1, 10); // true
 * inRange(10, 1, 10, false); // false
 * ```
 */
export function inRange(value: number, min: number, max: number, inclusive = true): boolean {
  if (inclusive) return value >= min && value <= max;
  return value > min && value < max;
}

/**
 * Converts a value to a number with a fallback on NaN.
 *
 * @param value - The value to convert
 * @param fallback - The fallback value if conversion fails (default: 0)
 * @returns The parsed number or the fallback
 *
 * @example
 * ```ts
 * toNumber('42'); // 42
 * toNumber('nope', 10); // 10
 * ```
 */
export function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Rounds `value` to `precision` decimal places (default: 0).
 *
 * @example
 * ```ts
 * round(1.2345, 2); // 1.23
 * round(1234.5);    // 1235
 * ```
 */
export function round(value: number, precision = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Rounds `value` to the nearest multiple of `step`.
 *
 * @example
 * ```ts
 * roundTo(13, 5); // 15
 * roundTo(0.27, 0.05); // 0.25
 * ```
 */
export function roundTo(value: number, step: number): number {
  if (step === 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Linear interpolation between `a` and `b` by `t` (typically in `[0, 1]`).
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse of {@link lerp}: returns `t` such that `lerp(a, b, t) === value`.
 * Returns `0` when `a === b`.
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Re-maps `value` from the range `[inMin, inMax]` to `[outMin, outMax]`.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + (outMax - outMin) * inverseLerp(inMin, inMax, value);
}

/**
 * Formats a value using `Intl.NumberFormat`. Kept module-local: the public
 * locale-aware `formatNumber` lives in `@bquery/bquery/i18n`.
 *
 * @internal
 */
const formatNumberLocal = (
  value: number,
  opts: Intl.NumberFormatOptions & { locale?: string | string[] } = {}
): string => {
  const { locale, ...rest } = opts;
  try {
    return new Intl.NumberFormat(locale, rest).format(value);
  } catch {
    return String(value);
  }
};

/** Options for {@link formatBytes}. */
export interface FormatBytesOptions {
  /** Number of decimal places (default: 2). */
  decimals?: number;
  /** Use binary base (1024) instead of decimal (1000). Default: false. */
  binary?: boolean;
  /** Optional locale used for the numeric portion. */
  locale?: string | string[];
}

const BIN_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
const DEC_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

/**
 * Formats a byte count as a human-readable string.
 *
 * @example
 * ```ts
 * formatBytes(1500);                // '1.50 KB'
 * formatBytes(1024, { binary: true }); // '1.00 KiB'
 * ```
 */
export function formatBytes(bytes: number, opts: FormatBytesOptions = {}): string {
  const { decimals = 2, binary = false, locale } = opts;
  if (!Number.isFinite(bytes)) return String(bytes);
  if (bytes === 0) return `0 ${binary ? BIN_UNITS[0] : DEC_UNITS[0]}`;
  const base = binary ? 1024 : 1000;
  const units = binary ? BIN_UNITS : DEC_UNITS;
  const abs = Math.abs(bytes);
  const exp = Math.min(units.length - 1, Math.floor(Math.log(abs) / Math.log(base)));
  const value = bytes / Math.pow(base, exp);
  const numberStr = formatNumberLocal(value, {
    locale,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${numberStr} ${units[exp]}`;
}

/**
 * Returns a random floating-point number in the half-open interval
 * `[min, max)`. Uses `Math.random()` — not cryptographically secure.
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Returns the arithmetic sum of an array of numbers. */
export function sum(items: readonly number[]): number {
  let total = 0;
  for (const n of items) total += n;
  return total;
}

/**
 * Returns the arithmetic mean of an array. Returns `0` for empty arrays.
 */
export function average(items: readonly number[]): number {
  if (items.length === 0) return 0;
  return sum(items) / items.length;
}

/**
 * Returns the median of an array. Returns `0` for empty arrays. For
 * even-length arrays the median is the average of the two central values.
 */
export function median(items: readonly number[]): number {
  if (items.length === 0) return 0;
  const sorted = items.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

/** Converts an angle in degrees to radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Converts an angle in radians to degrees. */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
