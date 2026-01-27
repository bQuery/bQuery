/**
 * Spring physics helpers.
 *
 * @module bquery/motion
 */

import type { Spring, SpringConfig } from './types';

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
};
