/**
 * Production hydration with configurable mismatch recovery.
 *
 * `verifyHydration()` (see `./mismatch`) reports *structural* divergence from
 * the server's `data-bq-h` signature and only ever warns. This module adds the
 * production-grade story tracked in GitHub issue #130:
 *
 * - `detectHydrationMismatches()` compares the **content** the server emitted
 *   (text, visibility, bound attributes, `bq-model` values) against what the
 *   client `context` evaluates to — the real "server data ≠ client data" case.
 * - `hydrate()` wraps `hydrateMount()` with a boundary-scoped recovery strategy
 *   (`warn` | `repair` | `error`) plus an `onError` hook, so a mismatch in
 *   production has a defined outcome instead of a silently broken UI.
 *
 * Detection is boundary-scoped (per directive-bearing element), uses the
 * CSP-safe expression evaluator (no `eval`), and skips expressions whose root
 * identifier is not present in `context` (e.g. `bq-for` loop variables) to
 * avoid false positives.
 *
 * @module bquery/ssr
 */

import { detectDevEnvironment } from '../core/env';
import type { BindingContext, View } from '../view/types';
import { resolveModelReflection } from './directive-support';
import { evaluateExpression } from './expression';
import { cheapHash, collectDirectiveSignatureFromElement, HYDRATION_HASH_ATTR } from './hash';
import { hydrateMount, type HydrateMountOptions } from './hydrate';

/** What kind of directive produced a hydration mismatch. */
export type HydrationMismatchKind = 'signature' | 'text' | 'show' | 'attribute' | 'model';

/** Recovery strategy applied when `hydrate()` detects a mismatch. */
export type MismatchStrategy = 'warn' | 'repair' | 'error';

/** A single content-level hydration mismatch. */
export interface HydrationBoundaryMismatch {
  /** The boundary element whose server output diverged. */
  element: Element;
  /** Which directive class produced the mismatch. */
  kind: HydrationMismatchKind;
  /** The offending directive, e.g. `bq-text` or `bq-bind:href`. */
  directive: string;
  /** The value currently present in the server-rendered DOM. */
  domValue: string;
  /** The value the client `context` evaluates to. */
  clientValue: string;
}

/** Options for `detectHydrationMismatches()`. */
export interface DetectHydrationOptions {
  /** Directive prefix to match. Default: `'bq'`. */
  prefix?: string;
}

const SENTINEL_ABSENT = '∅'; // ∅ — marks an absent attribute in reports.

/**
 * Extracts the leading identifier of an expression (after stripping unary
 * `!`/whitespace). Used to decide whether the expression is resolvable against
 * the top-level context.
 */
const leadingIdentifier = (expression: string): string | null => {
  const match = expression
    .trim()
    .replace(/^[!\s]+/, '')
    .match(/^[A-Za-z_$][\w$]*/);
  return match ? match[0] : null;
};

const JS_LITERAL_KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'typeof']);

/**
 * Whether an expression's root identifier resolves against `context`. Returns
 * `true` for constant expressions (no leading identifier) and JS literals.
 * Returns `false` for identifiers absent from the context, which is how
 * `bq-for` loop variables (`item`, `index`) are skipped to avoid false
 * positives — the server expanded those clones with a scope the client root
 * context does not carry.
 */
const hasResolvableRoot = (expression: string, context: BindingContext): boolean => {
  const root = leadingIdentifier(expression);
  if (root === null) return true;
  if (JS_LITERAL_KEYWORDS.has(root)) return true;
  return Object.prototype.hasOwnProperty.call(context, root);
};

const isElementHidden = (el: Element): boolean => {
  const style = (el as Partial<HTMLElement>).style;
  if (style && typeof style.display === 'string') {
    return style.display === 'none';
  }
  return /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(el.getAttribute('style') ?? '');
};

/** Collects the boundary elements (root + directive-bearing descendants). */
const collectBoundaries = (root: Element, prefix: string): Element[] => {
  const boundaries: Element[] = [];
  const directivePrefix = `${prefix}-`;
  const carriesDirective = (el: Element): boolean => {
    if (el.hasAttribute(HYDRATION_HASH_ATTR)) return true;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith(directivePrefix) || attr.name.startsWith(':')) return true;
    }
    return false;
  };
  if (carriesDirective(root)) boundaries.push(root);
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (carriesDirective(el)) boundaries.push(el);
  }
  return boundaries;
};

const checkElement = (
  el: Element,
  context: BindingContext,
  prefix: string,
  out: HydrationBoundaryMismatch[]
): void => {
  // Structural signature check (subsumes verifyHydration for annotated nodes).
  const expectedHash = el.getAttribute(HYDRATION_HASH_ATTR);
  if (expectedHash !== null) {
    const signature = collectDirectiveSignatureFromElement(el, prefix);
    const actualHash = cheapHash(signature);
    if (actualHash !== expectedHash) {
      out.push({
        element: el,
        kind: 'signature',
        directive: HYDRATION_HASH_ATTR,
        domValue: expectedHash,
        clientValue: actualHash,
      });
    }
  }

  // bq-text
  const textExpr = el.getAttribute(`${prefix}-text`);
  if (textExpr !== null && hasResolvableRoot(textExpr, context)) {
    const clientValue = String(evaluateExpression<unknown>(textExpr, context) ?? '');
    const domValue = el.textContent ?? '';
    if (clientValue !== domValue) {
      out.push({ element: el, kind: 'text', directive: `${prefix}-text`, domValue, clientValue });
    }
  }

  // bq-show
  const showExpr = el.getAttribute(`${prefix}-show`);
  if (showExpr !== null && hasResolvableRoot(showExpr, context)) {
    const clientHidden = !evaluateExpression<unknown>(showExpr, context);
    const domHidden = isElementHidden(el);
    if (clientHidden !== domHidden) {
      out.push({
        element: el,
        kind: 'show',
        directive: `${prefix}-show`,
        domValue: domHidden ? 'hidden' : 'visible',
        clientValue: clientHidden ? 'hidden' : 'visible',
      });
    }
  }

  // bq-bind:*
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith(`${prefix}-bind:`)) continue;
    const target = attr.name.slice(`${prefix}-bind:`.length);
    if (!hasResolvableRoot(attr.value, context)) continue;
    const value = evaluateExpression<unknown>(attr.value, context);
    const clientPresent = !(value === false || value === null || value === undefined);
    const clientValue = value === true ? '' : String(value);
    const domPresent = el.hasAttribute(target);
    const domValue = el.getAttribute(target) ?? '';
    if (clientPresent !== domPresent || (clientPresent && clientValue !== domValue)) {
      out.push({
        element: el,
        kind: 'attribute',
        directive: attr.name,
        domValue: domPresent ? domValue : SENTINEL_ABSENT,
        clientValue: clientPresent ? clientValue : SENTINEL_ABSENT,
      });
    }
  }

  // bq-model
  const modelExpr = el.getAttribute(`${prefix}-model`);
  if (modelExpr !== null && hasResolvableRoot(modelExpr, context)) {
    const reflection = resolveModelReflection(
      el.tagName,
      el.getAttribute('type') ?? undefined,
      el.getAttribute('value') ?? undefined,
      evaluateExpression<unknown>(modelExpr, context)
    );
    let domValue: string | null = null;
    let clientValue: string | null = null;
    if (reflection.kind === 'attr') {
      clientValue = reflection.value;
      domValue = el.getAttribute('value') ?? '';
    } else if (reflection.kind === 'boolean-attr') {
      clientValue = reflection.present ? 'checked' : 'unchecked';
      domValue = el.hasAttribute('checked') ? 'checked' : 'unchecked';
    } else if (reflection.kind === 'text') {
      clientValue = reflection.value;
      domValue = el.textContent ?? '';
    } else if (reflection.kind === 'select') {
      clientValue = reflection.value;
      const selected = el.querySelector('option[selected]');
      domValue = selected?.getAttribute('value') ?? selected?.textContent?.trim() ?? '';
    }
    if (domValue !== null && clientValue !== null && domValue !== clientValue) {
      out.push({
        element: el,
        kind: 'model',
        directive: `${prefix}-model`,
        domValue,
        clientValue,
      });
    }
  }
};

/**
 * Walks the directive-bearing elements under `root` and reports every place
 * where the server-rendered DOM disagrees with what the client `context`
 * evaluates to. Safe to call in any environment; returns `[]` when `root` has
 * no `querySelectorAll`.
 *
 * Covers `bq-text`, `bq-show`, `bq-bind:*`, `bq-model`, and the structural
 * `data-bq-h` signature. `bq-class`/`bq-style` are intentionally excluded
 * because their additive/merge semantics make exact comparison ambiguous.
 *
 * @example
 * ```ts
 * import { detectHydrationMismatches } from '@bquery/bquery/ssr';
 *
 * const mismatches = detectHydrationMismatches(document.getElementById('app')!, context);
 * if (mismatches.length) reportToDevtools(mismatches);
 * ```
 */
export const detectHydrationMismatches = (
  root: Element | Document,
  context: BindingContext,
  options: DetectHydrationOptions = {}
): HydrationBoundaryMismatch[] => {
  const prefix = options.prefix ?? 'bq';
  const mismatches: HydrationBoundaryMismatch[] = [];
  if (!root || typeof (root as Element).querySelectorAll !== 'function') {
    return mismatches;
  }
  // Document has no attributes of its own; start from the documentElement.
  const start: Element | null =
    typeof (root as Element).getAttribute === 'function'
      ? (root as Element)
      : (root as Document).documentElement;
  if (!start) return mismatches;
  for (const boundary of collectBoundaries(start, prefix)) {
    checkElement(boundary, context, prefix, mismatches);
  }
  return mismatches;
};

/** Repairs a single boundary by writing the client value back into the DOM. */
const repairMismatch = (mismatch: HydrationBoundaryMismatch, prefix: string): void => {
  const { element, kind } = mismatch;
  if (kind === 'text') {
    element.textContent = mismatch.clientValue;
    return;
  }
  if (kind === 'show') {
    const htmlEl = element as Partial<HTMLElement>;
    const hide = mismatch.clientValue === 'hidden';
    if (htmlEl.style) {
      if (hide) htmlEl.style.display = 'none';
      else if (htmlEl.style.display === 'none') htmlEl.style.removeProperty('display');
    } else if (hide) {
      element.setAttribute('style', 'display: none;');
    }
    return;
  }
  if (kind === 'attribute') {
    const target = mismatch.directive.slice(`${prefix}-bind:`.length);
    if (mismatch.clientValue === SENTINEL_ABSENT) element.removeAttribute(target);
    else element.setAttribute(target, mismatch.clientValue);
    return;
  }
  if (kind === 'model') {
    // Disambiguate by element shape, never by sniffing the value string — a
    // text input whose value is literally "checked" must stay a value write.
    const tag = element.tagName.toLowerCase();
    if (tag === 'textarea') {
      element.textContent = mismatch.clientValue;
    } else if (tag === 'select') {
      for (const option of Array.from(element.querySelectorAll('option'))) {
        const optionValue = option.getAttribute('value') ?? option.textContent?.trim() ?? '';
        if (optionValue === mismatch.clientValue) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      }
    } else {
      const type = (element.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (mismatch.clientValue === 'checked') element.setAttribute('checked', '');
        else element.removeAttribute('checked');
      } else {
        element.setAttribute('value', mismatch.clientValue);
      }
    }
  }
  // 'signature' mismatches cannot be content-repaired here; mount() reconciles
  // the reactive bindings on the following hydrateMount() pass.
};

/** Options for `hydrate()`. */
export interface HydrateOptions extends HydrateMountOptions {
  /**
   * What to do when a hydration mismatch is detected.
   * - `'warn'` (default) logs each mismatch (dev-gated when left at the
   *   default; always logged when set explicitly).
   * - `'repair'` rewrites the affected boundary from client state before
   *   attaching reactivity.
   * - `'error'` routes each mismatch to `onError`; without an `onError` it
   *   throws before mounting.
   */
  onMismatch?: MismatchStrategy;
  /** Boundary-scoped error sink, used by the `'error'` strategy. */
  onError?: (error: Error, boundary: Element) => void;
  /** Directive prefix. Default: `'bq'`. */
  prefix?: string;
}

/** Result of `hydrate()`. */
export interface HydrateResult {
  /** The mounted, now-reactive view. */
  view: View;
  /** Every mismatch detected before reactivity was attached. */
  mismatches: HydrationBoundaryMismatch[];
}

const resolveRoot = (selector: string | Element): Element => {
  if (typeof selector !== 'string') return selector;
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
    throw new Error(`bQuery ssr: hydrate() cannot resolve "${selector}" without a DOM.`);
  }
  const el = document.querySelector(selector);
  if (!el) throw new Error(`bQuery ssr: hydrate() target "${selector}" not found.`);
  return el;
};

/**
 * Hydrates server-rendered DOM with a defined mismatch-recovery strategy.
 *
 * Detection runs against the untouched server output *before* reactivity is
 * attached, so it sees the real server↔client divergence; the chosen strategy
 * then warns, repairs, or surfaces each mismatch to an error boundary. After
 * that, `hydrateMount()` attaches the reactive bindings as usual.
 *
 * @example
 * ```ts
 * import { hydrate } from '@bquery/bquery/ssr';
 *
 * const { mismatches } = hydrate('#app', context, {
 *   onMismatch: 'repair',
 *   onError: (err, boundary) => reportToDevtools(err, boundary),
 * });
 * ```
 */
export const hydrate = (
  selector: string | Element,
  context: BindingContext,
  options: HydrateOptions = {}
): HydrateResult => {
  const { onMismatch, onError, prefix = 'bq', ...mountOptions } = options;
  const strategy: MismatchStrategy = onMismatch ?? 'warn';
  const warnIsDefault = onMismatch === undefined;

  const root = resolveRoot(selector);
  const mismatches = detectHydrationMismatches(root, context, { prefix });

  if (mismatches.length > 0) {
    if (strategy === 'error') {
      for (const mismatch of mismatches) {
        const error = new Error(
          `[bQuery SSR] Hydration mismatch (${mismatch.kind}) on <${mismatch.element.tagName.toLowerCase()}> ` +
            `${mismatch.directive}: server="${mismatch.domValue}" client="${mismatch.clientValue}".`
        );
        if (onError) onError(error, mismatch.element);
        else throw error;
      }
    } else if (strategy === 'repair') {
      for (const mismatch of mismatches) repairMismatch(mismatch, prefix);
    } else {
      // 'warn'
      const shouldWarn = !warnIsDefault || detectDevEnvironment();
      if (shouldWarn && typeof console !== 'undefined' && typeof console.warn === 'function') {
        for (const mismatch of mismatches) {
          console.warn(
            `[bQuery SSR] Hydration mismatch (${mismatch.kind}) on ` +
              `<${mismatch.element.tagName.toLowerCase()}> ${mismatch.directive}: ` +
              `server="${mismatch.domValue}" client="${mismatch.clientValue}".`,
            mismatch.element
          );
        }
      }
    }
  }

  const view = hydrateMount(root, context, { prefix, ...mountOptions } as HydrateMountOptions);
  return { view, mismatches };
};
