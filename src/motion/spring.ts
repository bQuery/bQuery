/**
 * Spring physics helpers.
 *
 * @module bquery/motion
 */

import type { Spring, SpringConfig, SpringVector, SpringVectorEntry } from './types';

/**
 * Default spring configuration values.
 */
const DEFAULT_SPRING_CONFIG: Required<SpringConfig> = {
  stiffness: 100,
  damping: 10,
  mass: 1,
  precision: 0.01,
};

/**
 * Create a spring-based animation for smooth, physics-based motion.
 *
 * Uses variable frame rate timing based on `requestAnimationFrame` timestamps
 * to ensure consistent animation speed across different devices and frame rates.
 * Large time deltas (e.g., from tab backgrounding) are clamped to maintain
 * simulation stability.
 *
 * @param initialValue - Starting value for the spring
 * @param config - Spring physics configuration
 * @returns Spring instance for controlling the animation
 *
 * @example
 * ```ts
 * const x = spring(0, { stiffness: 120, damping: 14 });
 * x.onChange((value) => {
 *   element.style.transform = `translateX(${value}px)`;
 * });
 * await x.to(100);
 * ```
 */
export const spring = (initialValue: number, config: SpringConfig = {}): Spring => {
  const { stiffness, damping, mass, precision } = {
    ...DEFAULT_SPRING_CONFIG,
    ...config,
  };

  let current = initialValue;
  let velocity = 0;
  let target = initialValue;
  let animationFrame: number | null = null;
  let resolvePromise: (() => void) | null = null;
  let lastTime: number | null = null;
  const listeners = new Set<(value: number) => void>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener(current);
    }
  };

  const step = (timestamp: number) => {
    // Calculate time delta (in seconds) from last frame
    // If this is the first frame, use a sensible default (1/60s)
    // This ensures the animation speed is independent of frame rate
    const deltaTime = lastTime !== null ? (timestamp - lastTime) / 1000 : 1 / 60;
    // Clamp large deltas to prevent instability (e.g. tab backgrounding)
    // Maximum delta of 1/30s (~33ms) keeps simulation stable
    const clampedDelta = Math.min(deltaTime, 1 / 30);
    lastTime = timestamp;

    // Spring physics calculation
    const displacement = current - target;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * clampedDelta;
    current += velocity * clampedDelta;

    notifyListeners();

    // Check if spring has settled
    if (Math.abs(velocity) < precision && Math.abs(displacement) < precision) {
      current = target;
      velocity = 0;
      animationFrame = null;
      notifyListeners();
      resolvePromise?.();
      resolvePromise = null;
      return;
    }

    animationFrame = requestAnimationFrame(step);
  };

  return {
    to(newTarget: number): Promise<void> {
      target = newTarget;

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      // Resolve any pending promise from a previous to() call
      // This ensures all returned promises eventually settle
      resolvePromise?.();

      // Reset lastTime to ensure clean start for new animation
      lastTime = null;

      return new Promise((resolve) => {
        resolvePromise = resolve;
        animationFrame = requestAnimationFrame(step);
      });
    },

    current(): number {
      return current;
    },

    velocity(value?: number): number {
      if (typeof value === 'number' && Number.isFinite(value)) {
        velocity = value;
      }
      return velocity;
    },

    set(value: number): void {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      current = value;
      target = value;
      velocity = 0;
      lastTime = null;
      notifyListeners();
      resolvePromise?.();
      resolvePromise = null;
    },

    stop(): void {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      velocity = 0;
      lastTime = null;
      resolvePromise?.();
      resolvePromise = null;
    },

    onChange(callback: (value: number) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
};

/**
 * Preset spring configurations for common use cases.
 *
 * Includes the original four bQuery presets plus three extended presets
 * (`wobbly`, `slow`, `molasses`) familiar from popular physics libraries.
 */
export const springPresets = {
  /** Gentle, slow-settling spring */
  gentle: { stiffness: 80, damping: 15 } as SpringConfig,
  /** Responsive, snappy spring */
  snappy: { stiffness: 200, damping: 20 } as SpringConfig,
  /** Bouncy, playful spring */
  bouncy: { stiffness: 300, damping: 8 } as SpringConfig,
  /** Stiff, quick spring with minimal overshoot */
  stiff: { stiffness: 400, damping: 30 } as SpringConfig,
  /** Lively, jiggly spring with pronounced wobble */
  wobbly: { stiffness: 180, damping: 12 } as SpringConfig,
  /** Heavy, slow spring suitable for large gestures */
  slow: { stiffness: 60, damping: 22 } as SpringConfig,
  /** Very heavy, ponderous spring */
  molasses: { stiffness: 30, damping: 28, mass: 2 } as SpringConfig,
};

/**
 * Drive multiple coupled springs in parallel.
 *
 * Each named dimension has its own underlying scalar `spring`, and
 * `.to()` resolves only after every dimension has settled. Useful for
 * coordinated 2D / 3D / arbitrary-N motion.
 *
 * @param initial - Record of starting values per dimension
 * @param config - Shared spring physics configuration
 *
 * @example
 * ```ts
 * const pos = springVector({ x: 0, y: 0 }, springPresets.snappy);
 * pos.onChange(({ x, y }) => el.style.transform = `translate(${x}px, ${y}px)`);
 * await pos.to({ x: 100, y: 40 });
 * ```
 */
export const springVector = <T extends Record<string, number>>(
  initial: T,
  config: SpringConfig = {}
): SpringVector<T> => {
  const keys = Object.keys(initial) as Array<keyof T & string>;
  const springs = {} as Record<keyof T & string, SpringVectorEntry>;
  for (const key of keys) {
    springs[key] = spring(initial[key], config);
  }

  const listeners = new Set<(value: T) => void>();
  const dimensionUnsubscribers = new Map<keyof T & string, () => void>();
  const snapshot = (): T => {
    const out = {} as T;
    for (const key of keys) {
      (out as Record<string, number>)[key] = springs[key].current();
    }
    return out;
  };

  const notifyVectorListeners = () => {
    if (listeners.size === 0) return;
    const snap = snapshot();
    for (const listener of listeners) listener(snap);
  };

  const subscribeDimensions = () => {
    for (const key of keys) {
      if (dimensionUnsubscribers.has(key)) continue;
      const unsubscribe = springs[key].onChange(() => {
        notifyVectorListeners();
      });
      dimensionUnsubscribers.set(key, unsubscribe);
    }
  };

  const unsubscribeDimensions = () => {
    for (const key of keys) {
      const unsubscribe = dimensionUnsubscribers.get(key);
      if (!unsubscribe) continue;
      unsubscribe();
      dimensionUnsubscribers.delete(key);
    }
  };

  const removeListener = (callback: (value: T) => void) => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      unsubscribeDimensions();
    }
  };

  return {
    to(target: Partial<T>): Promise<void> {
      const promises: Promise<void>[] = [];
      for (const key of keys) {
        const next = target[key];
        if (typeof next === 'number') {
          promises.push(springs[key].to(next));
        }
      }
      return Promise.all(promises).then(() => undefined);
    },
    current(): T {
      return snapshot();
    },
    velocity(value?: Partial<T>): T {
      const out = {} as T;
      for (const key of keys) {
        const v = value?.[key];
        const result = springs[key].velocity(typeof v === 'number' ? v : undefined);
        (out as Record<string, number>)[key] = result;
      }
      return out;
    },
    set(value: Partial<T>): void {
      for (const key of keys) {
        const next = value[key];
        if (typeof next === 'number') {
          springs[key].set(next);
        }
      }
    },
    stop(): void {
      for (const key of keys) springs[key].stop();
    },
    onChange(callback: (value: T) => void): () => void {
      if (listeners.size === 0) {
        subscribeDimensions();
      }
      listeners.add(callback);
      return () => removeListener(callback);
    },
    dimensions(): Record<keyof T & string, SpringVectorEntry> {
      return springs;
    },
  };
};
