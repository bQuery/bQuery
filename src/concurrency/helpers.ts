/**
 * Small helpers for transferables and shared buffers.
 *
 * @module bquery/concurrency
 */

const isTransferable = (value: unknown): value is Transferable => {
  return (
    value instanceof ArrayBuffer ||
    (typeof MessagePort !== 'undefined' && value instanceof MessagePort) ||
    (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas)
  );
};

const visitTransferables = (value: unknown, seen: WeakSet<object>, out: Transferable[]): void => {
  if (isTransferable(value)) {
    out.push(value);
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const objectValue = value as Record<PropertyKey, unknown>;

  if (seen.has(objectValue)) {
    return;
  }

  seen.add(objectValue);

  if (ArrayBuffer.isView(value)) {
    const buffer = (value as ArrayBufferView).buffer;
    if (buffer instanceof ArrayBuffer) {
      out.push(buffer);
    }
    return;
  }

  if (objectValue instanceof Map) {
    for (const [key, mapValue] of objectValue as Map<unknown, unknown>) {
      visitTransferables(key, seen, out);
      visitTransferables(mapValue, seen, out);
    }
    return;
  }

  if (objectValue instanceof Set) {
    for (const setValue of objectValue as Set<unknown>) {
      visitTransferables(setValue, seen, out);
    }
    return;
  }

  for (const nested of Object.values(objectValue)) {
    visitTransferables(nested, seen, out);
  }
};

/**
 * Walks a payload and returns discovered transferable values.
 */
export const withTransferables = <TValue>(
  value: TValue
): {
  transfer: Transferable[];
  value: TValue;
} => {
  const transfer: Transferable[] = [];
  visitTransferables(value, new WeakSet<object>(), transfer);
  return { transfer, value };
};

/**
 * Creates a SharedArrayBuffer when supported.
 */
export const createSharedBuffer = (byteLength: number): SharedArrayBuffer => {
  if (typeof SharedArrayBuffer !== 'function') {
    throw new Error('SharedArrayBuffer is not available in this runtime.');
  }

  if (!Number.isInteger(byteLength) || byteLength < 0) {
    throw new RangeError('SharedArrayBuffer byteLength must be a non-negative integer.');
  }

  return new SharedArrayBuffer(byteLength);
};
