/**
 * Motion module providing view transitions, FLIP animations, spring physics,
 * parallax, typewriter effects, tweens, and micro-interactions.
 * Designed to work with modern browser APIs while providing smooth fallbacks.
 *
 * @module bquery/motion
 */

export type {
  AnimateOptions,
  EasingFunction,
  ElementBounds,
  FlipGroupOptions,
  FlipOptions,
  MorphOptions,
  ParallaxCleanup,
  ParallaxOptions,
  ScrollAnimateCleanup,
  ScrollAnimateOptions,
  SequenceOptions,
  SequenceStep,
  Spring,
  SpringConfig,
  SpringVector,
  SpringVectorEntry,
  StaggerFunction,
  StaggerOptions,
  TimelineConfig,
  TimelineAt,
  TimelineControls,
  TimelineLabel,
  TimelineLabelOffset,
  TimelineRelativeOffset,
  TimelineRepeat,
  TimelineStep,
  TransitionOptions,
  TypewriterControls,
  TypewriterOptions,
} from './types';

export { animate, animateTo } from './animate';
export type { AnimateToOptions, AnimateToStyles } from './animate';
export {
  // Linear
  linear,
  // Quad
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  // Cubic
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  // Quart
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  // Quint
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  // Sine
  easeInSine,
  easeOutSine,
  easeInOutSine,
  // Expo
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  // Circ
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  // Back
  easeInBack,
  easeOutBack,
  easeInOutBack,
  // Elastic
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  // Bounce
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
  // Composers / factories
  cubicBezier,
  steps,
  mix,
  chain,
  easingPresets,
} from './easing';
export type { StepPosition } from './easing';
export { capturePosition, flip, flipElements, flipList } from './flip';
export { keyframePresets } from './keyframes';
export { morphElement } from './morph';
export { parallax } from './parallax';
export { onReducedMotionChange, prefersReducedMotion, setReducedMotion } from './reduced-motion';
export { reducedMotionSignal } from './reduced-motion-signal';
export { scrollAnimate } from './scroll';
export { inView, scrollProgress } from './scroll-progress';
export type {
  InViewHandle,
  InViewOptions,
  ScrollProgressCleanup,
  ScrollProgressOptions,
} from './scroll-progress';
export { spring, springPresets, springVector } from './spring';
export { stagger } from './stagger';
export { sequence, timeline } from './timeline';
export { transition } from './transition';
export { animateValue, tween } from './tween';
export type { TweenControls, TweenOptions, TweenValue } from './tween';
export { typewriter } from './typewriter';
export { countUp, magnetic, pulse, shake, tilt } from './effects';
export type {
  CountUpOptions,
  EffectCleanup,
  MagneticOptions,
  PulseOptions,
  ShakeOptions,
  TiltOptions,
} from './effects';
