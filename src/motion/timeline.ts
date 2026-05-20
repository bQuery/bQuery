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
  TimelineRepeat,
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

const resolveAt = (
  at: TimelineStep['at'],
  previousEnd: number,
  labels: Map<string, number>
): number => {
  if (typeof at === 'number') return at;
  if (typeof at === 'string') {
    // Plain numeric relative offsets: +=N, -=N
    const relativeMatch = /^([+-])=(\d+(?:\.\d+)?)$/.exec(at);
    if (relativeMatch) {
      const delta = Number.parseFloat(relativeMatch[2]);
      if (!Number.isFinite(delta)) return previousEnd;
      return relativeMatch[1] === '+' ? previousEnd + delta : previousEnd - delta;
    }
    // Label-relative offsets: 'name', 'name+=N', 'name-=N'
    const labelMatch = /^([A-Za-z_$][\w$]*)\s*(?:([+-])=\s*(\d+(?:\.\d+)?))?$/.exec(at);
    if (labelMatch && labels.has(labelMatch[1])) {
      const base = labels.get(labelMatch[1]) ?? previousEnd;
      if (!labelMatch[2]) return base;
      const delta = Number.parseFloat(labelMatch[3]);
      if (!Number.isFinite(delta)) return base;
      return labelMatch[2] === '+' ? base + delta : base - delta;
    }
  }
  return previousEnd;
};

const normalizeDuration = (options?: KeyframeAnimationOptions): number => {
  const baseDuration = resolveTimeValue(options?.duration as number | string | undefined);
  const endDelay = resolveTimeValue(options?.endDelay as number | string | undefined);
  const rawIterations = options?.iterations ?? 1;

  // Handle infinite iterations - treat as a special case with a very large duration
  // In practice, infinite iterations shouldn't be used in timelines as they never end
  if (rawIterations === Infinity) {
    // Return a large sentinel value - timeline calculations will be incorrect,
    // but this at least prevents NaN/Infinity from breaking scheduling
    return Number.MAX_SAFE_INTEGER;
  }

  // Per Web Animations spec, iterations must be a non-negative number
  // Treat negative as 0 (only endDelay duration)
  const iterations = Math.max(0, rawIterations);

  // Total duration = (baseDuration * iterations) + endDelay
  // Note: endDelay is applied once at the end, after all iterations
  return baseDuration * iterations + endDelay;
};

const scheduleSteps = (steps: TimelineStep[], labels: Map<string, number>) => {
  let previousEnd = 0;
  return steps.map((step) => {
    const baseStart = resolveAt(step.at, previousEnd, labels);
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
 * Supports labels (`addLabel('name', at?)`), label-relative `at` strings
 * (`'label+=200'`), `reverse()`, `playbackRate()`, `repeat()`, `yoyo()`,
 * `onUpdate()` ticks, and a `progress()` getter in `[0, 1]`.
 *
 * @param initialSteps - Steps for the timeline
 * @param config - Timeline configuration
 */
export const timeline = (
  initialSteps: TimelineStep[] = [],
  config: TimelineConfig = {}
): TimelineControls => {
  const steps = [...initialSteps];
  const labels = new Map<string, number>();
  const finishListeners = new Set<() => void>();
  const updateListeners = new Set<(time: number) => void>();
  let animations: Array<{ animation: Animation; step: TimelineStep; start: number }> = [];
  let totalDuration = 0;
  let reducedMotionApplied = false;
  let finalized = false;
  let rate = 1;
  let repeatCount: TimelineRepeat = 0;
  let yoyoEnabled = false;
  let updateFrame: number | null = null;
  let currentIteration = 0;
  let runningDirection: 1 | -1 = 1;

  const { commitStyles = true, respectReducedMotion = true, onFinish } = config;

  const stopUpdateLoop = () => {
    if (updateFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(updateFrame);
    }
    updateFrame = null;
  };

  const notifyUpdate = (time: number) => {
    for (const listener of updateListeners) listener(time);
  };

  const startUpdateLoop = () => {
    if (typeof requestAnimationFrame !== 'function') return;
    if (updateListeners.size === 0) return;
    if (updateFrame !== null) return;
    if (finalized) return;
    const tick = () => {
      if (finalized || updateListeners.size === 0 || animations.length === 0) {
        updateFrame = null;
        return;
      }
      const sample = animations[0]?.animation;
      const time = typeof sample?.currentTime === 'number' ? sample.currentTime : 0;
      notifyUpdate(time);
      if (finalized || updateListeners.size === 0 || animations.length === 0) {
        updateFrame = null;
        return;
      }
      updateFrame = requestAnimationFrame(tick);
    };
    updateFrame = requestAnimationFrame(tick);
  };

  const finalize = () => {
    if (finalized) return;
    finalized = true;
    stopUpdateLoop();

    for (const item of animations) {
      const { animation, step } = item;
      if (commitStyles) {
        if (typeof animation.commitStyles === 'function') {
          animation.commitStyles();
        } else {
          applyFinalKeyframeStyles(step.target, step.keyframes);
        }
      }
      animation.cancel();
    }

    finishListeners.forEach((listener) => listener());
    onFinish?.();
  };

  const buildAnimations = (direction: 1 | -1) => {
    animations.forEach(({ animation }) => animation.cancel());
    animations = [];
    finalized = false;
    runningDirection = direction;

    const schedule = scheduleSteps(steps, labels);
    totalDuration = schedule.length ? Math.max(...schedule.map((item) => item.end)) : 0;

    if (respectReducedMotion && prefersReducedMotion()) {
      if (commitStyles) {
        schedule.forEach(({ step }) => applyFinalKeyframeStyles(step.target, step.keyframes));
      }
      reducedMotionApplied = true;
      return;
    }

    // Check if Web Animations API is available on all targets
    const animateUnavailable = schedule.some(
      ({ step }) => typeof (step.target as HTMLElement).animate !== 'function'
    );
    if (animateUnavailable) {
      if (commitStyles) {
        schedule.forEach(({ step }) => applyFinalKeyframeStyles(step.target, step.keyframes));
      }
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
      try {
        animation.playbackRate = rate * direction;
      } catch {
        // ignore
      }
      return { animation, step, start };
    });
  };

  const playOnce = async (direction: 1 | -1): Promise<void> => {
    buildAnimations(direction);

    if (reducedMotionApplied || animations.length === 0) {
      finalize();
      return;
    }

    if (direction === -1) {
      animations.forEach(({ animation }) => {
        try {
          animation.currentTime = totalDuration;
        } catch {
          // ignore
        }
      });
    }

    startUpdateLoop();

    const finishPromises = animations.map((item) =>
      item.animation.finished.catch(() => undefined)
    );
    await Promise.all(finishPromises);
    stopUpdateLoop();
  };

  const resolveRepeat = (): number => {
    if (repeatCount === 'infinite') return Number.POSITIVE_INFINITY;
    return Math.max(0, repeatCount);
  };

  const controls: TimelineControls = {
    add(step: TimelineStep): void {
      steps.push(step);
    },

    addLabel(name: string, at?: number | string): void {
      const previousEnd = scheduleSteps(steps, labels).reduce(
        (acc, item) => Math.max(acc, item.end),
        0
      );
      const time = resolveAt(at, previousEnd, labels);
      labels.set(name, Math.max(0, time));
    },

    label(name: string): number | undefined {
      return labels.get(name);
    },

    duration(): number {
      if (!steps.length) return 0;
      if (!animations.length) {
        const schedule = scheduleSteps(steps, labels);
        return Math.max(...schedule.map((item) => item.end));
      }
      return totalDuration;
    },

    async play(): Promise<void> {
      currentIteration = 0;
      const total = resolveRepeat();
      let direction: 1 | -1 = 1;

      while (currentIteration <= total) {
        await playOnce(direction);
        if (finalized) {
          // External stop() finalized us mid-run.
          return;
        }
        currentIteration += 1;
        if (currentIteration > total) break;
        if (yoyoEnabled) direction = direction === 1 ? -1 : 1;
        // Reset finalized flag for the next iteration's buildAnimations().
      }

      finalize();
    },

    pause(): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => animation.pause());
      stopUpdateLoop();
    },

    resume(): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => animation.play());
      startUpdateLoop();
    },

    stop(): void {
      stopUpdateLoop();
      animations.forEach(({ animation }) => animation.cancel());
      animations = [];
      reducedMotionApplied = false;
      finalized = true;
    },

    seek(time: number): void {
      if (reducedMotionApplied) return;
      animations.forEach(({ animation }) => {
        // currentTime is measured from the beginning of the animation including delay,
        // so we set it directly to the requested timeline time
        animation.currentTime = time;
      });
      notifyUpdate(time);
    },

    reverse(): void {
      runningDirection = runningDirection === 1 ? -1 : 1;
      animations.forEach(({ animation }) => {
        try {
          animation.playbackRate = rate * runningDirection;
        } catch {
          // ignore
        }
      });
    },

    playbackRate(value?: number): number {
      if (typeof value === 'number' && Number.isFinite(value)) {
        rate = value;
        animations.forEach(({ animation }) => {
          try {
            animation.playbackRate = rate * runningDirection;
          } catch {
            // ignore
          }
        });
      }
      return rate;
    },

    repeat(count: TimelineRepeat): void {
      repeatCount = count;
    },

    yoyo(enabled: boolean): void {
      yoyoEnabled = enabled;
    },

    progress(): number {
      if (!animations.length || totalDuration <= 0) return 0;
      const sample = animations[0].animation;
      const current = typeof sample.currentTime === 'number' ? sample.currentTime : 0;
      return Math.min(1, Math.max(0, current / totalDuration));
    },

    onUpdate(callback: (time: number) => void): () => void {
      updateListeners.add(callback);
      if (updateListeners.size === 1 && animations.length > 0) {
        startUpdateLoop();
      }
      return () => {
        updateListeners.delete(callback);
        if (updateListeners.size === 0) stopUpdateLoop();
      };
    },

    onFinish(callback: () => void): () => void {
      finishListeners.add(callback);
      return () => finishListeners.delete(callback);
    },
  };

  return controls;
};
