/**
 * Timeline and sequence helpers.
 *
 * @module bquery/motion
 */

import { animate, applyFinalKeyframeStyles } from './animate';
import { prefersReducedMotion } from './reduced-motion';
import type {
  SequenceOptions,
  SequenceStep,
  TimelineConfig,
  TimelineControls,
  TimelineStep,
} from './types';

const resolveTimeValue = (value?: number | string): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.endsWith('ms')) {
      const parsed = Number.parseFloat(trimmed.slice(0, -2));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (trimmed.endsWith('s')) {
      const parsed = Number.parseFloat(trimmed.slice(0, -1));
      return Number.isFinite(parsed) ? parsed * 1000 : 0;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const resolveAt = (at: TimelineStep['at'], previousEnd: number): number => {
  if (typeof at === 'number') return at;
  if (typeof at === 'string') {
    const match = /^([+-])=(\d+(?:\.\d+)?)$/.exec(at);
    if (match) {
      const delta = Number.parseFloat(match[2]);
      if (!Number.isFinite(delta)) return previousEnd;
      return match[1] === '+' ? previousEnd + delta : previousEnd - delta;
    }
  }
  return previousEnd;
};

const normalizeDuration = (options?: KeyframeAnimationOptions): number => {
  const baseDuration = resolveTimeValue(options?.duration as number | string | undefined);
  const endDelay = resolveTimeValue(options?.endDelay as number | string | undefined);
  const iterations = options?.iterations ?? 1;

  // Handle infinite iterations - treat as a special case with a very large duration
  // In practice, infinite iterations shouldn't be used in timelines as they never end
  if (iterations === Infinity) {
    // Return a large sentinel value - timeline calculations will be incorrect,
    // but this at least prevents NaN/Infinity from breaking scheduling
    return Number.MAX_SAFE_INTEGER;
  }

  // Total duration = (baseDuration * iterations) + endDelay
  // Note: endDelay is applied once at the end, after all iterations
  return baseDuration * iterations + endDelay;
};

const scheduleSteps = (steps: TimelineStep[]) => {
  let previousEnd = 0;
  return steps.map((step) => {
    const baseStart = resolveAt(step.at, previousEnd);
    const stepDelay = resolveTimeValue(step.options?.delay as number | string | undefined);
    const start = Math.max(0, baseStart + stepDelay);
    const duration = normalizeDuration(step.options);
    const end = start + duration;
    previousEnd = Math.max(previousEnd, end);
    return { step, start, end, duration };
  });
};

/**
 * Run a list of animations sequentially.
 *
 * @param steps - Steps to run in order
 * @param options - Sequence configuration
 */
export const sequence = async (
  steps: SequenceStep[],
  options: SequenceOptions = {}
): Promise<void> => {
  const { stagger, onFinish } = options;
  const total = steps.length;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const delay = stagger ? stagger(index, total) : 0;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await animate(step.target, step);
  }

  onFinish?.();
};

/**
 * Create a timeline controller for multiple animations.
 *
 * @param initialSteps - Steps for the timeline
 * @param config - Timeline configuration
 */
export const timeline = (
  initialSteps: TimelineStep[] = [],
  config: TimelineConfig = {}
): TimelineControls => {
  const steps = [...initialSteps];
  const listeners = new Set<() => void>();
  let animations: Array<{ animation: Animation; step: TimelineStep; start: number }> = [];
  let totalDuration = 0;
  let reducedMotionApplied = false;
  let finalized = false;

  const { commitStyles = true, respectReducedMotion = true, onFinish } = config;

  const finalize = () => {
    if (finalized) return;
    finalized = true;

    if (commitStyles) {
      for (const item of animations) {
        const { animation, step } = item;
        if (typeof animation.commitStyles === 'function') {
          animation.commitStyles();
        } else {
          applyFinalKeyframeStyles(step.target, step.keyframes);
        }
        animation.cancel();
      }
    }

    listeners.forEach((listener) => listener());
    onFinish?.();
  };

  const buildAnimations = () => {
    animations.forEach(({ animation }) => animation.cancel());
    animations = [];
    finalized = false;

    const schedule = scheduleSteps(steps);
    totalDuration = schedule.length ? Math.max(...schedule.map((item) => item.end)) : 0;

    if (respectReducedMotion && prefersReducedMotion()) {
      schedule.forEach(({ step }) => applyFinalKeyframeStyles(step.target, step.keyframes));
      reducedMotionApplied = true;
      return;
    }

    // Check if Web Animations API is available on all targets
    const animateUnavailable = schedule.some(
      ({ step }) => typeof (step.target as HTMLElement).animate !== 'function'
    );
    if (animateUnavailable) {
      schedule.forEach(({ step }) => applyFinalKeyframeStyles(step.target, step.keyframes));
      reducedMotionApplied = true;
      return;
    }

    reducedMotionApplied = false;
    animations = schedule.map(({ step, start }) => {
      const { delay: _delay, ...options } = step.options ?? {};
      const animation = step.target.animate(step.keyframes, {
        ...options,
        delay: start,
        fill: options.fill ?? 'both',
      });
      return { animation, step, start };
    });
  };

  return {
    add(step: TimelineStep): void {
      steps.push(step);
    },

    duration(): number {
      if (!steps.length) return 0;
      if (!animations.length) {
        const schedule = scheduleSteps(steps);
        return Math.max(...schedule.map((item) => item.end));
      }
      return totalDuration;
    },

    async play(): Promise<void> {
      buildAnimations();

      if (reducedMotionApplied || animations.length === 0) {
        finalize();
        return;
      }

      const finishPromises = animations.map((item) =>
        item.animation.finished.catch(() => undefined)
      );
      await Promise.all(finishPromises);
      finalize();
    },

    pause(): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => animation.pause());
    },

    resume(): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => animation.play());
    },

    stop(): void {
      animations.forEach(({ animation }) => animation.cancel());
      animations = [];
      reducedMotionApplied = false;
    },

    seek(time: number): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => {
        // currentTime is measured from the beginning of the animation including delay,
        // so we set it directly to the requested timeline time
        animation.currentTime = time;
      });
    },

    onFinish(callback: () => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
};
