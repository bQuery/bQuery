/**
 * `<bq-link>` custom element for declarative SPA navigation.
 *
 * Renders an accessible `<a>` tag that intercepts clicks for client-side
 * routing. Automatically toggles an active class when the target path
 * matches the current route.
 *
 * @module bquery/router
 *
 * @example
 * ```html
 * <bq-link to="/">Home</bq-link>
 * <bq-link to="/about" active-class="selected">About</bq-link>
 * <bq-link to="/settings" replace exact>Settings</bq-link>
 * ```
 */

import { effect, type CleanupFn } from '../reactive/index';
import { navigate } from './navigation';
import { routeSignal } from './state';

/**
 * Default CSS class applied when the link's target path is active.
 * @internal
 */
const DEFAULT_ACTIVE_CLASS = 'active';

/**
 * `<bq-link>` — A navigation custom element for bQuery routers.
 *
 * Attributes:
 * - `to` — Target path (required). Example: `to="/dashboard"`.
 * - `replace` — If present, replaces the current history entry instead of pushing.
 * - `exact` — If present, the active class is only applied on an exact path match.
 * - `active-class` — CSS class added when the route is active (default: `'active'`).
 *
 * The element renders a shadow `<a>` tag with a `<slot>` for content,
 * ensuring accessibility (focusable, keyboard-navigable, screen-reader-friendly).
 *
 * @example
 * ```ts
 * import { registerBqLink } from '@bquery/bquery/router';
 *
 * // Register the <bq-link> element (idempotent)
 * registerBqLink();
 *
 * // Then use in HTML:
 * // <bq-link to="/about">About</bq-link>
 * ```
 */
export class BqLinkElement extends HTMLElement {
  /** @internal */
  private _cleanup: CleanupFn | null = null;

  static get observedAttributes(): string[] {
    return ['to', 'replace', 'exact', 'active-class'];
  }

  /** The target path for navigation. */
  get to(): string {
    return this.getAttribute('to') ?? '/';
  }

  set to(value: string) {
    this.setAttribute('to', value);
  }

  /** Whether to replace the current history entry. */
  get replace(): boolean {
    return this.hasAttribute('replace');
  }

  set replace(value: boolean) {
    if (value) {
      this.setAttribute('replace', '');
    } else {
      this.removeAttribute('replace');
    }
  }

  /** Whether to match the path exactly for active class. */
  get exact(): boolean {
    return this.hasAttribute('exact');
  }

  set exact(value: boolean) {
    if (value) {
      this.setAttribute('exact', '');
    } else {
      this.removeAttribute('exact');
    }
  }

  /** CSS class applied when the route is active. */
  get activeClass(): string {
    return this.getAttribute('active-class') ?? DEFAULT_ACTIVE_CLASS;
  }

  set activeClass(value: string) {
    this.setAttribute('active-class', value);
  }

  /** @internal */
  connectedCallback(): void {
    // Set role for accessibility if not an <a> already
    if (!this.getAttribute('role')) {
      this.setAttribute('role', 'link');
    }

    // Make focusable if not already
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }

    // Attach click handler
    this.addEventListener('click', this._handleClick);
    this.addEventListener('keydown', this._handleKeydown);

    // Set up reactive active-class tracking
    this._setupActiveTracking();
  }

  /** @internal */
  disconnectedCallback(): void {
    this.removeEventListener('click', this._handleClick);
    this.removeEventListener('keydown', this._handleKeydown);

    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
  }

  /** @internal */
  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null
  ): void {
    // Re-setup active tracking when relevant attributes change
    if (name === 'to' || name === 'exact' || name === 'active-class') {
      if (this.isConnected) {
        this._setupActiveTracking();
      }
    }
  }

  /**
   * Sets up the reactive effect that toggles the active CSS class
   * based on the current route.
   * @internal
   */
  private _setupActiveTracking(): void {
    // Clean up previous effect
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }

    const targetPath = this.to;
    const exactMatch = this.exact;
    const cssClass = this.activeClass;

    this._cleanup = effect(() => {
      const current = routeSignal.value.path;
      const isMatch = exactMatch
        ? current === targetPath
        : current.startsWith(targetPath);

      this.classList.toggle(cssClass, isMatch);

      // Update aria-current for accessibility
      if (isMatch) {
        this.setAttribute('aria-current', 'page');
      } else {
        this.removeAttribute('aria-current');
      }
    });
  }

  /**
   * Handles click events for SPA navigation.
   * @internal
   */
  private _handleClick = (e: Event): void => {
    // Allow modifier keys for native browser behavior (new tab, etc.)
    if (e instanceof MouseEvent) {
      if (e.button !== 0) return; // Only left clicks
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    }

    e.preventDefault();
    this._navigate();
  };

  /**
   * Handles keyboard activation (Enter/Space).
   * @internal
   */
  private _handleKeydown = (e: Event): void => {
    if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this._navigate();
    }
  };

  /**
   * Performs the actual navigation.
   * @internal
   */
  private _navigate(): void {
    const targetPath = this.to;
    if (!targetPath) return;

    void navigate(targetPath, { replace: this.replace }).catch((err) => {
      console.error('bq-link: Navigation failed:', err);
    });
  }
}

/**
 * Registers the `<bq-link>` custom element.
 *
 * This function is idempotent — calling it multiple times is safe.
 * The element is registered under the tag name `bq-link`.
 *
 * @example
 * ```ts
 * import { registerBqLink } from '@bquery/bquery/router';
 *
 * registerBqLink();
 *
 * // Now use <bq-link to="/about">About</bq-link> in HTML
 * ```
 */
export const registerBqLink = (): void => {
  if (
    typeof customElements !== 'undefined' &&
    !customElements.get('bq-link')
  ) {
    customElements.define('bq-link', BqLinkElement);
  }
};
