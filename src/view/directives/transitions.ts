/**
 * Declarative enter/leave/move transitions for the view layer.
 *
 * This is a thin declarative binding over the existing `motion` primitives —
 * it does not implement a second animation engine. Enter/leave keyframes run
 * through the Web Animations API (the same path `motion` uses), FLIP moves
 * delegate to `motion`'s `flip()` / `capturePosition()`, and every transition
 * honours the shared reduced-motion preference via `prefersReducedMotion()`.
 *
 * Authors attach transitions with plain companion attributes that the
 * structural directives (`bq-if`, `bq-show`, `bq-for`) read:
 *
 * ```html
 * <div bq-if="open" bq-transition="fade" bq-transition-duration="200">…</div>
 * <li bq-if="visible" bq-in="slide-up" bq-out="fade">…</li>
 * <li bq-for="item in items" bq-key="item.id" bq-animate="flip">…</li>
 * ```
 *
 * @module bquery/view
 * @since 1.15.0
 */

import { prefersReducedMotion } from '../../motion/reduced-motion';

/**
 * Companion attributes consumed by structural directives to drive transitions.
 * The view pipeline treats these as passive (never warns about them and never
 * processes them as standalone directives).
 *
 * @internal
 */
export const TRANSITION_ATTRS = [
  'transition',
  'transition-duration',
  'transition-easing',
  'in',
  'out',
  'animate',
] as const;

/** Default enter/leave duration in milliseconds. */
const DEFAULT_DURATION = 200;
/** Default easing for enter/leave transitions. */
const DEFAULT_EASING = 'ease';

/**
 * Built-in transition presets, expressed as enter keyframes (hidden → visible).
 * The leave keyframes are the reverse (visible → hidden), so a single named
 * preset describes a symmetric in/out pair.
 *
 * @internal
 */
const PRESETS: Record<string, Keyframe[]> = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  scale: [
    { opacity: 0, transform: 'scale(0.96)' },
    { opacity: 1, transform: 'scale(1)' },
  ],
  'slide-up': [
    { opacity: 0, transform: 'translateY(10px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  'slide-down': [
    { opacity: 0, transform: 'translateY(-10px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  'slide-left': [
    { opacity: 0, transform: 'translateX(10px)' },
    { opacity: 1, transform: 'translateX(0)' },
  ],
  'slide-right': [
    { opacity: 0, transform: 'translateX(-10px)' },
    { opacity: 1, transform: 'translateX(0)' },
  ],
};
// `slide` is an alias for `slide-up`.
PRESETS.slide = PRESETS['slide-up'];

/** Resolved transition configuration for an element. */
export type ViewTransitionConfig = {
  /** Enter keyframes (hidden → visible), or `null` when no enter transition. */
  enter: Keyframe[] | null;
  /** Leave keyframes (visible → hidden), or `null` when no leave transition. */
  leave: Keyframe[] | null;
  /** Duration in milliseconds. */
  duration: number;
  /** CSS easing string. */
  easing: string;
};

/**
 * Resolves a preset name to its enter keyframes. An unknown but non-empty name
 * falls back to `fade` so a typo degrades to a sensible animation rather than
 * silently doing nothing. An empty name yields `null`.
 *
 * @internal
 */
const resolvePresetKeyframes = (name: string | null): Keyframe[] | null => {
  if (name == null) return null;
  const trimmed = name.trim();
  if (trimmed === '') return null;
  return PRESETS[trimmed] ?? PRESETS.fade;
};

/** Reverses a keyframe list so an enter preset becomes its leave counterpart. */
const reverseKeyframes = (frames: Keyframe[]): Keyframe[] => [...frames].reverse();

/**
 * Reads the transition companion attributes from an element and resolves them
 * into enter/leave keyframes plus timing. Returns `null` when the element has
 * no transition attributes at all, so callers can take their synchronous path.
 *
 * @internal
 */
export const resolveTransition = (el: Element, prefix: string): ViewTransitionConfig | null => {
  const transitionAttr = el.getAttribute(`${prefix}-transition`);
  const inAttr = el.getAttribute(`${prefix}-in`);
  const outAttr = el.getAttribute(`${prefix}-out`);

  if (transitionAttr == null && inAttr == null && outAttr == null) {
    return null;
  }

  const durationAttr = el.getAttribute(`${prefix}-transition-duration`);
  const easingAttr = el.getAttribute(`${prefix}-transition-easing`);

  const parsedDuration = durationAttr != null ? Number(durationAttr) : NaN;
  const duration =
    Number.isFinite(parsedDuration) && parsedDuration >= 0 ? parsedDuration : DEFAULT_DURATION;
  const easing =
    easingAttr != null && easingAttr.trim() !== '' ? easingAttr.trim() : DEFAULT_EASING;

  const enter = resolvePresetKeyframes(inAttr ?? transitionAttr);
  const leaveBase = resolvePresetKeyframes(outAttr ?? transitionAttr);
  const leave = leaveBase ? reverseKeyframes(leaveBase) : null;

  return { enter, leave, duration, easing };
};

/**
 * Cancels any animations currently running on an element. Used to clear a
 * `fill: 'forwards'` leave animation before re-entering, and to avoid stacking
 * animations on rapid toggles. No-ops where `Element.getAnimations` is absent
 * (e.g. some test DOMs).
 *
 * @internal
 */
export const cancelTransitions = (el: Element): void => {
  const animatable = el as Element & { getAnimations?: () => Animation[] };
  if (typeof animatable.getAnimations === 'function') {
    for (const animation of animatable.getAnimations()) {
      animation.cancel();
    }
  }
};

/**
 * Runs a keyframe transition on an element and resolves when it finishes.
 *
 * Resolves immediately (a no-op) when there are no keyframes, when the user
 * prefers reduced motion, or when the Web Animations API is unavailable — in
 * every such case the caller's commit logic still runs, so behaviour is
 * identical to having no transition.
 *
 * @param fill - `'none'` for enter (revert to natural styles afterwards),
 *   `'forwards'` for leave (hold the hidden end-state until the element is
 *   removed, preventing a visible flash).
 * @internal
 */
export const runTransition = (
  el: Element,
  keyframes: Keyframe[] | null,
  config: ViewTransitionConfig,
  fill: 'none' | 'forwards'
): Promise<void> => {
  const animatable = el as HTMLElement & {
    animate?: (frames: Keyframe[], opts: KeyframeAnimationOptions) => Animation;
  };

  if (!keyframes || keyframes.length === 0 || prefersReducedMotion()) {
    return Promise.resolve();
  }
  if (typeof animatable.animate !== 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const animation = animatable.animate(keyframes, {
      duration: config.duration,
      easing: config.easing,
      fill,
    });

    animation.onfinish = finish;
    animation.oncancel = finish;
    // Belt-and-braces for engines that resolve `finished` without firing the
    // `onfinish`/`oncancel` handlers.
    if (animation.finished && typeof animation.finished.then === 'function') {
      animation.finished.then(finish).catch(finish);
    }
  });
};
