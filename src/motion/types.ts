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
  /** Stop the animation */
  stop(): void;
  /** Subscribe to value changes */
  onChange(callback: (value: number) => void): () => void;
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
}

/**
 * Stagger helper configuration.
 */
export interface StaggerOptions {
  /** Start delay in milliseconds (default: 0) */
  start?: number;
  /** Origin index or keyword (default: 'start') */
  from?: 'start' | 'center' | 'end' | number;
  /** Optional easing function for normalized distance */
  easing?: EasingFunction;
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
 * Timeline step configuration.
 */
export interface TimelineStep {
  /** Target element to animate */
  target: Element;
  /** Keyframes to animate */
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  /** Animation options for this step */
  options?: KeyframeAnimationOptions;
  /** Absolute or relative start time in milliseconds */
  at?: number | `+=${number}` | `-=${number}`;
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
  /** Total timeline duration in milliseconds */
  duration(): number;
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
