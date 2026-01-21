/**
 * Motion module providing view transitions, FLIP animations, and spring physics.
 * Designed to work with modern browser APIs while providing smooth fallbacks.
 *
 * @module bquery/motion
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Options for view transitions.
 */
export interface TransitionOptions {
  /** The DOM update function to execute during transition */
  update: () => void;
}

/**
 * Captured element bounds for FLIP animations.
 */
export interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * FLIP animation configuration options.
 */
export interface FlipOptions {
  /** Animation duration in milliseconds */
  duration?: number;
  /** CSS easing function */
  easing?: string;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * Spring physics configuration.
 */
export interface SpringConfig {
  /** Spring stiffness (default: 100) */
  stiffness?: number;
  /** Damping coefficient (default: 10) */
  damping?: number;
  /** Mass of the object (default: 1) */
  mass?: number;
  /** Velocity threshold for completion (default: 0.01) */
  precision?: number;
}

/**
 * Spring instance for animating values.
 */
export interface Spring {
  /** Start animating to target value */
  to(target: number): Promise<void>;
  /** Get current animated value */
  current(): number;
  /** Stop the animation */
  stop(): void;
  /** Subscribe to value changes */
  onChange(callback: (value: number) => void): () => void;
}

// ============================================================================
// View Transitions
// ============================================================================

/** Extended document type with View Transitions API */
type DocumentWithTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

/**
 * Execute a DOM update with view transition animation.
 * Falls back to immediate update when View Transitions API is unavailable.
 *
 * @param updateOrOptions - Update function or options object
 * @returns Promise that resolves when transition completes
 *
 * @example
 * ```ts
 * await transition(() => {
 *   $('#content').text('Updated');
 * });
 * ```
 */
export const transition = async (
  updateOrOptions: (() => void) | TransitionOptions
): Promise<void> => {
  const update = typeof updateOrOptions === 'function' ? updateOrOptions : updateOrOptions.update;

  const doc = document as DocumentWithTransition;

  if (doc.startViewTransition) {
    await doc.startViewTransition(() => update()).finished;
    return;
  }

  update();
};

// ============================================================================
// FLIP Animations
// ============================================================================

/**
 * Capture the current bounds of an element for FLIP animation.
 *
 * @param element - The DOM element to measure
 * @returns The element's current position and size
 */
export const capturePosition = (element: Element): ElementBounds => {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

/**
 * Perform a FLIP (First, Last, Invert, Play) animation.
 * Animates an element from its captured position to its current position.
 *
 * @param element - The element to animate
 * @param firstBounds - The previously captured bounds
 * @param options - Animation configuration
 * @returns Promise that resolves when animation completes
 *
 * @example
 * ```ts
 * const first = capturePosition(element);
 * // ... DOM changes that move the element ...
 * await flip(element, first, { duration: 300 });
 * ```
 */
export const flip = (
  element: Element,
  firstBounds: ElementBounds,
  options: FlipOptions = {}
): Promise<void> => {
  const { duration = 300, easing = 'ease-out', onComplete } = options;

  // Last: Get current position
  const lastBounds = capturePosition(element);

  // Skip animation if element has zero dimensions (avoid division by zero)
  if (lastBounds.width === 0 || lastBounds.height === 0) {
    return Promise.resolve();
  }

  // Invert: Calculate the delta
  const deltaX = firstBounds.left - lastBounds.left;
  const deltaY = firstBounds.top - lastBounds.top;
  const deltaW = firstBounds.width / lastBounds.width;
  const deltaH = firstBounds.height / lastBounds.height;

  // Skip animation if no change
  if (deltaX === 0 && deltaY === 0 && deltaW === 1 && deltaH === 1) {
    return Promise.resolve();
  }

  const htmlElement = element as HTMLElement;

  // Apply inverted transform
  htmlElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  htmlElement.style.transformOrigin = 'top left';

  // Force reflow
  void htmlElement.offsetHeight;

  // Play: Animate back to current position
  return new Promise((resolve) => {
    const animation = htmlElement.animate(
      [
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`,
        },
        { transform: 'translate(0, 0) scale(1, 1)' },
      ],
      { duration, easing, fill: 'forwards' }
    );

    animation.onfinish = () => {
      htmlElement.style.transform = '';
      htmlElement.style.transformOrigin = '';
      onComplete?.();
      resolve();
    };
  });
};

/**
 * FLIP helper for animating a list of elements.
 * Useful for reordering lists with smooth animations.
 *
 * @param elements - Array of elements to animate
 * @param performUpdate - Function that performs the DOM update
 * @param options - Animation configuration
 *
 * @example
 * ```ts
 * await flipList(listItems, () => {
 *   container.appendChild(container.firstChild); // Move first to last
 * });
 * ```
 */
export const flipList = async (
  elements: Element[],
  performUpdate: () => void,
  options: FlipOptions = {}
): Promise<void> => {
  // First: Capture all positions
  const positions = new Map<Element, ElementBounds>();
  for (const el of elements) {
    positions.set(el, capturePosition(el));
  }

  // Perform DOM update
  performUpdate();

  // Animate each element
  const animations = elements.map((el) => {
    const first = positions.get(el);
    if (!first) return Promise.resolve();
    return flip(el, first, options);
  });

  await Promise.all(animations);
};

// ============================================================================
// Spring Physics
// ============================================================================

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
  const listeners = new Set<(value: number) => void>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener(current);
    }
  };

  const step = () => {
    // Spring physics calculation
    const displacement = current - target;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * (1 / 60); // Assuming 60fps
    current += velocity * (1 / 60);

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
