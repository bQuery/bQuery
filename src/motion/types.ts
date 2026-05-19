/**
 * Shared Motion module types.
 *
 * @module bquery/motion
 */

/**
 * Options for view transitions.
 */
export interface TransitionOptions {
  /** The DOM update function to execute during transition */
  update: () => void | Promise<void>;
  /** Skip the transition when reduced motion is preferred. */
  skipOnReducedMotion?: boolean;
  /** Classes applied to the root element while the transition is active. */
  classes?: string[];
  /** Transition types added when supported by the browser. */
  types?: string[];
  /** Called after the transition becomes ready. */
  onReady?: () => void;
  /** Called after the transition finishes. */
  onFinish?: () => void;
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
 * Stagger delay function signature.
 */
export type StaggerFunction = (index: number, total: number) => number;

/**
 * Extended options for group FLIP animations.
 */
export interface FlipGroupOptions extends FlipOptions {
  /** Optional stagger delay function */
  stagger?: StaggerFunction;
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
  /**
   * Read or set the spring's velocity.
   * Call with no argument to read; pass a number to inject velocity
   * (useful for continuing motion after a gesture release).
   */
  velocity(value?: number): number;
  /** Snap to a value instantly without animation; resets velocity. */
  set(value: number): void;
  /** Stop the animation */
  stop(): void;
  /** Subscribe to value changes */
  onChange(callback: (value: number) => void): () => void;
}

/**
 * A single dimension within a {@link SpringVector}.
 */
export type SpringVectorEntry = Spring;

/**
 * Coordinated multi-dimensional spring driver returned by
 * `springVector()`.
 */
export interface SpringVector<T extends Record<string, number>> {
  /** Animate one or more dimensions toward target values. */
  to(target: Partial<T>): Promise<void>;
  /** Snapshot of the current value per dimension. */
  current(): T;
  /** Read or inject velocity per dimension. */
  velocity(value?: Partial<T>): T;
  /** Snap one or more dimensions to a value instantly. */
  set(value: Partial<T>): void;
  /** Stop every dimension. */
  stop(): void;
  /** Subscribe to combined value changes. */
  onChange(callback: (value: T) => void): () => void;
  /** Access the per-dimension underlying springs (advanced use). */
  dimensions(): Record<keyof T & string, SpringVectorEntry>;
}

/**
 * Web Animations helper configuration.
 */
export interface AnimateOptions {
  /** Keyframes to animate */
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  /** Animation options (duration, easing, etc.) */
  options?: KeyframeAnimationOptions;
  /** Commit final styles to the element (default: true) */
  commitStyles?: boolean;
  /** Respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
  /** Callback when animation completes */
  onFinish?: () => void;
  /** Optional `AbortSignal` to cancel the animation early. */
  signal?: AbortSignal;
  /** Override the animation's `playbackRate` (e.g. `0.5` for slow motion). */
  playbackRate?: number;
}

/**
 * Stagger helper configuration.
 */
export interface StaggerOptions {
  /** Start delay in milliseconds (default: 0) */
  start?: number;
  /**
   * Origin index or keyword. Accepts:
   * - `'start'` | `'center'` | `'end'`,
   * - a numeric index (linear mode),
   * - a `{ x, y }` cell coordinate (grid mode).
   * Default: `'start'`.
   */
  from?: 'start' | 'center' | 'end' | number | { x: number; y: number };
  /** Optional easing function for normalized distance */
  easing?: EasingFunction;
  /**
   * Enable grid mode by supplying `[columns, rows]`. Distance is measured
   * across the 2D layout from `from` (which may be a `{ x, y }` cell).
   */
  grid?: [number, number];
  /**
   * In grid mode, restrict the distance metric to a single axis.
   * Default: 2D Euclidean distance.
   */
  axis?: 'x' | 'y';
  /**
   * Randomize the per-index distance. When `true`, each index gets a
   * partially shuffled delay derived from `Math.random()` (or `randomSeed`
   * when provided for deterministic output).
   */
  random?: boolean;
  /** Optional integer seed for the randomized variant. */
  randomSeed?: number;
}

/**
 * Easing function signature.
 */
export type EasingFunction = (t: number) => number;

/**
 * Sequence step configuration.
 */
export interface SequenceStep extends AnimateOptions {
  /** Target element to animate */
  target: Element;
}

/**
 * Sequence run configuration.
 */
export interface SequenceOptions {
  /** Optional stagger delay between steps */
  stagger?: StaggerFunction;
  /** Callback when sequence completes */
  onFinish?: () => void;
}

/**
 * Repeat count for a {@link TimelineControls}. Pass `'infinite'` to loop forever.
 */
export type TimelineRepeat = number | 'infinite';

/**
 * Timeline step configuration.
 */
export interface TimelineStep {
  /** Target element to animate */
  target: Element;
  /** Keyframes to animate */
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  /** Animation options for this step */
  options?: KeyframeAnimationOptions;
  /**
   * Absolute or relative start time. Accepts:
   * - a number in milliseconds (absolute),
   * - a `+=N` / `-=N` offset from the previous step's end,
   * - a label name (e.g. `'label'`),
   * - a label-relative offset (e.g. `'label+=200'`, `'label-=50'`).
   */
  at?: number | string;
  /** Optional label for debugging */
  label?: string;
}

/**
 * Timeline configuration.
 */
export interface TimelineConfig {
  /** Commit final styles when timeline completes (default: true) */
  commitStyles?: boolean;
  /** Respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
  /** Callback when timeline completes */
  onFinish?: () => void;
}

/**
 * Timeline controls.
 */
export interface TimelineControls {
  /** Play all steps */
  play(): Promise<void>;
  /** Pause animations */
  pause(): void;
  /** Resume animations */
  resume(): void;
  /** Stop and cancel animations */
  stop(): void;
  /** Seek to a specific time in milliseconds */
  seek(time: number): void;
  /** Add a step to the timeline */
  add(step: TimelineStep): void;
  /**
   * Add a named label at the given timeline time. If `at` is omitted, the
   * label is positioned at the end of the currently scheduled steps.
   * Accepts the same `at` formats as {@link TimelineStep.at}.
   */
  addLabel(name: string, at?: number | string): void;
  /** Look up the absolute time (ms) of a label. */
  label(name: string): number | undefined;
  /** Total timeline duration in milliseconds */
  duration(): number;
  /**
   * Reverse the running direction. Playback continues from the current
   * `currentTime` in the opposite direction.
   */
  reverse(): void;
  /**
   * Read or set the playback rate. A rate of `2` plays twice as fast; `0.5`
   * plays half-speed. Negative rates reverse the animation. Returns the
   * effective playback rate.
   */
  playbackRate(value?: number): number;
  /**
   * Repeat the timeline N additional times after the first play. Pass
   * `'infinite'` to loop until `stop()` is called. Default: `0`.
   */
  repeat(count: TimelineRepeat): void;
  /**
   * When enabled together with {@link repeat}, alternate direction each
   * iteration (forward, backward, forward …).
   */
  yoyo(enabled: boolean): void;
  /** Current progress in `[0, 1]` based on the timeline's `currentTime`. */
  progress(): number;
  /** Subscribe to per-frame `currentTime` updates while playing. */
  onUpdate(callback: (time: number) => void): () => void;
  /** Subscribe to finish events */
  onFinish(callback: () => void): () => void;
}

/**
 * Scroll animation configuration.
 */
export interface ScrollAnimateOptions extends AnimateOptions {
  /** IntersectionObserver root */
  root?: Element | Document | null;
  /** Root margin for observer */
  rootMargin?: string;
  /** Intersection thresholds */
  threshold?: number | number[];
  /** Trigger only once (default: true) */
  once?: boolean;
  /** Callback when element enters the viewport */
  onEnter?: (element: Element) => void;
}

/**
 * Cleanup function for scroll animations.
 */
export type ScrollAnimateCleanup = () => void;

/**
 * Options for the `morphElement` FLIP-based morph animation.
 */
export interface MorphOptions {
  /** Animation duration in milliseconds (default: 300) */
  duration?: number;
  /** CSS easing function (default: 'ease') */
  easing?: string;
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
  /** Callback when morph completes */
  onComplete?: () => void;
}

/**
 * Options for the `parallax` scroll-linked effect.
 */
export interface ParallaxOptions {
  /** Parallax speed multiplier (default: 0.5). Values < 1 are slower, > 1 are faster. */
  speed?: number;
  /** Direction of the parallax effect (default: 'vertical') */
  direction?: 'vertical' | 'horizontal' | 'both';
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
}

/**
 * Cleanup function for the parallax effect.
 */
export type ParallaxCleanup = () => void;

/**
 * Options for the `typewriter` text animation.
 */
export interface TypewriterOptions {
  /** Time in milliseconds between each character (default: 50) */
  speed?: number;
  /** Initial delay before starting, in milliseconds (default: 0) */
  delay?: number;
  /** Whether to show a blinking cursor (default: false) */
  cursor?: boolean;
  /** Cursor character (default: '|') */
  cursorChar?: string;
  /** Whether to loop the animation (default: false) */
  loop?: boolean;
  /** Pause duration at end before looping, in ms (default: 1000) */
  loopDelay?: number;
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
  /** Callback when typing completes (per-loop) */
  onComplete?: () => void;
}

/**
 * Controls for an active typewriter animation.
 */
export interface TypewriterControls {
  /** Stop the animation and clean up */
  stop(): void;
  /** Promise that resolves when the animation finishes, or when a looping animation is stopped */
  done: Promise<void>;
}
