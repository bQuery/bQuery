import type { ReadonlySignal } from '../reactive/index';

/**
 * Type definitions for the bQuery accessibility (a11y) module.
 *
 * @module bquery/a11y
 */

// ─── Focus Trap ──────────────────────────────────────────────────────────────

/**
 * Options for configuring focus trapping behavior.
 */
export interface TrapFocusOptions {
  /**
   * Element to receive initial focus when the trap activates.
   * If not provided, the first focusable element is focused.
   */
  initialFocus?: HTMLElement | string;

  /**
   * Element to receive focus when the trap is released.
   * If not provided, focus returns to the element that was focused
   * before the trap was activated.
   */
  returnFocus?: HTMLElement | string;

  /**
   * Whether pressing Escape releases the focus trap.
   * @default true
   */
  escapeDeactivates?: boolean;

  /**
   * Callback invoked when the trap is deactivated via Escape.
   */
  onEscape?: () => void;
}

/**
 * Handle returned by `trapFocus()` for managing the focus trap lifecycle.
 */
export interface FocusTrapHandle {
  /** Release the focus trap, restoring focus to the previous element. */
  release: () => void;
  /** Whether the trap is currently active. */
  active: boolean;
}

// ─── Screen Reader Announcements ─────────────────────────────────────────────

/**
 * Priority level for screen reader announcements.
 * - `'polite'` — announced when the user is idle (default)
 * - `'assertive'` — announced immediately, interrupting current speech
 */
export type AnnouncePriority = 'polite' | 'assertive';

// ─── Roving Tab Index ────────────────────────────────────────────────────────

/**
 * Options for configuring roving tab index behavior.
 */
export interface RovingTabIndexOptions {
  /**
   * Whether navigation wraps around from last to first (and vice versa).
   * @default true
   */
  wrap?: boolean;

  /**
   * Orientation of the group — determines which arrow keys are used.
   * - `'horizontal'` — Left/Right arrows
   * - `'vertical'` — Up/Down arrows
   * - `'both'` — All arrow keys
   * @default 'vertical'
   */
  orientation?: 'horizontal' | 'vertical' | 'both';

  /**
   * Callback fired when the active item changes.
   */
  onActivate?: (element: Element, index: number) => void;
}

/**
 * Handle returned by `rovingTabIndex()` for cleanup.
 */
export interface RovingTabIndexHandle {
  /** Remove event listeners and restore original tabindex values. */
  destroy: () => void;
  /** Programmatically focus a specific item by index. */
  focusItem: (index: number) => void;
  /** Get the currently active index. */
  activeIndex: () => number;
}

// ─── Skip Link ───────────────────────────────────────────────────────────────

/**
 * Options for configuring auto-generated skip navigation.
 */
export interface SkipLinkOptions {
  /**
   * Text content of the skip link.
   * @default 'Skip to main content'
   */
  text?: string;

  /**
   * CSS class applied to the skip link element.
   * @default 'bq-skip-link'
   */
  className?: string;
}

/**
 * Handle returned by `skipLink()` for cleanup.
 */
export interface SkipLinkHandle {
  /** Remove the skip link from the DOM. */
  destroy: () => void;
  /**
   * The created skip link element, or `null` when `skipLink()` is called in a
   * non-DOM environment and returns a no-op handle.
   */
  element: HTMLAnchorElement | null;
}

// ─── Media Preferences ───────────────────────────────────────────────────────

/**
 * Color scheme preference value.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * Contrast preference value.
 */
export type ContrastPreference = 'no-preference' | 'more' | 'less' | 'custom';

/**
 * Readonly media preference signal with an explicit cleanup hook.
 */
export interface MediaPreferenceSignal<T> extends ReadonlySignal<T> {
  /** Releases underlying media-query listeners. Safe to call multiple times. */
  destroy(): void;
}

// ─── Accessibility Audit ─────────────────────────────────────────────────────

/**
 * Severity level for audit findings.
 */
export type AuditSeverity = 'error' | 'warning' | 'info';

/**
 * A single accessibility audit finding.
 */
export interface AuditFinding {
  /** Severity level of the finding. */
  severity: AuditSeverity;
  /** Human-readable description of the issue. */
  message: string;
  /** The DOM element with the issue. */
  element: Element;
  /** The audit rule that triggered this finding. */
  rule: string;
}

/**
 * Result of an accessibility audit.
 */
export interface AuditResult {
  /** All findings from the audit. */
  findings: AuditFinding[];
  /** Number of errors found. */
  errors: number;
  /** Number of warnings found. */
  warnings: number;
  /** Whether the audit passed (no errors). */
  passed: boolean;
}
