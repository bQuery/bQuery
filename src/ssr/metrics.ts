/**
 * Lightweight SSR metrics collector.
 *
 * @module bquery/ssr
 */

export interface SSRMetricsSnapshot {
  hydrationMismatches: number;
  renderCount: number;
  slotCount: number;
  totalRenderMs: number;
  totalSlotMs: number;
}

export interface SSRMetrics {
  /** Records a completed render duration in milliseconds. */
  recordRender(durationMs: number): void;
  /** Records one streamed/deferred slot duration in milliseconds. */
  recordSlot(durationMs: number): void;
  /** Records a hydration mismatch observation. */
  recordHydrationMismatch(): void;
  /** Returns the current immutable metrics snapshot. */
  snapshot(): SSRMetricsSnapshot;
}

export const createSSRMetrics = (): SSRMetrics => {
  const state: SSRMetricsSnapshot = {
    hydrationMismatches: 0,
    renderCount: 0,
    slotCount: 0,
    totalRenderMs: 0,
    totalSlotMs: 0,
  };

  return {
    recordRender(durationMs) {
      state.renderCount += 1;
      state.totalRenderMs += durationMs;
    },
    recordSlot(durationMs) {
      state.slotCount += 1;
      state.totalSlotMs += durationMs;
    },
    recordHydrationMismatch() {
      state.hydrationMismatches += 1;
    },
    snapshot() {
      return { ...state };
    },
  };
};
