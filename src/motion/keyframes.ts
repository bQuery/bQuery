/**
 * Keyframe presets.
 *
 * @module bquery/motion
 */

/**
 * Common keyframe presets for quick animations.
 */
export const keyframePresets = {
  fadeIn: (from = 0, to = 1): Keyframe[] => [{ opacity: from }, { opacity: to }],
  fadeOut: (from = 1, to = 0): Keyframe[] => [{ opacity: from }, { opacity: to }],
  slideInUp: (distance = 16): Keyframe[] => [
    { opacity: 0, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  slideInDown: (distance = 16): Keyframe[] => [
    { opacity: 0, transform: `translateY(-${distance}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  slideInLeft: (distance = 16): Keyframe[] => [
    { opacity: 0, transform: `translateX(${distance}px)` },
    { opacity: 1, transform: 'translateX(0)' },
  ],
  slideInRight: (distance = 16): Keyframe[] => [
    { opacity: 0, transform: `translateX(-${distance}px)` },
    { opacity: 1, transform: 'translateX(0)' },
  ],
  scaleIn: (from = 0.95, to = 1): Keyframe[] => [
    { opacity: 0, transform: `scale(${from})` },
    { opacity: 1, transform: `scale(${to})` },
  ],
  scaleOut: (from = 1, to = 0.95): Keyframe[] => [
    { opacity: 1, transform: `scale(${from})` },
    { opacity: 0, transform: `scale(${to})` },
  ],
  pop: (from = 0.9, mid = 1.02, to = 1): Keyframe[] => [
    { opacity: 0, transform: `scale(${from})` },
    { opacity: 1, transform: `scale(${mid})`, offset: 0.6 },
    { opacity: 1, transform: `scale(${to})` },
  ],
  rotateIn: (degrees = 6): Keyframe[] => [
    { opacity: 0, transform: `rotate(${degrees}deg) scale(0.98)` },
    { opacity: 1, transform: 'rotate(0deg) scale(1)' },
  ],
};
