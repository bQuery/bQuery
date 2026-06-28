import { effect, signal, type CleanupFn, type Signal } from '../../reactive/index';
import { detectDevEnvironment } from '../../core/env';
import { capturePosition, flip } from '../../motion/flip';
import { prefersReducedMotion } from '../../motion/reduced-motion';
import type { ElementBounds } from '../../motion/types';
import { evaluate } from '../evaluate';
import type { BindingContext, DirectiveHandler } from '../types';
import { resolveTransition, runTransition } from './transitions';

/** Default FLIP-move duration (ms) when `bq-transition-duration` is absent. */
const DEFAULT_FLIP_DURATION = 300;
/** Default FLIP-move easing when `bq-transition-easing` is absent. */
const DEFAULT_FLIP_EASING = 'ease-out';

type ProcessElementFn = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[]
) => boolean;

type ProcessChildrenFn = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[]
) => void;

/**
 * Represents a rendered item in bq-for with its DOM element and associated cleanup functions.
 * @internal
 */
type RenderedItem = {
  key: unknown;
  element: Element;
  cleanups: CleanupFn[];
  item: unknown;
  index: number;
  itemSignal: Signal<unknown>; // Reactive item value for item-dependent bindings
  indexSignal: Signal<number> | null; // Reactive index for index-dependent bindings
};

/**
 * Extracts a key from an item using the key expression or falls back to index.
 * @internal
 */
const getItemKey = (
  item: unknown,
  index: number,
  keyExpression: string | null,
  itemName: string,
  indexName: string | undefined,
  context: BindingContext
): unknown => {
  if (!keyExpression) {
    return index; // Fallback to index-based keying
  }

  const keyContext: BindingContext = {
    ...context,
    [itemName]: item,
  };
  if (indexName) {
    keyContext[indexName] = index;
  }

  return evaluate(keyExpression, keyContext);
};

/**
 * Handles bq-for directive - list rendering with keyed reconciliation.
 *
 * Supports optional `:key` attribute for efficient DOM reuse:
 * ```html
 * <li bq-for="item in items" :key="item.id">...</li>
 * ```
 *
 * Without a key, falls back to index-based tracking (less efficient for reordering).
 *
 * @internal
 */
export const createForHandler = (options: {
  prefix: string;
  processElement: ProcessElementFn;
  processChildren: ProcessChildrenFn;
}): DirectiveHandler => {
  const { prefix, processElement, processChildren } = options;

  return (el, expression, context, cleanups) => {
    const parent = el.parentNode;
    if (!parent) return;

    // Parse expression: "item in items" or "(item, index) in items"
    // Use \S.* instead of .+ to prevent ReDoS by requiring non-whitespace start
    const match = expression.match(/^\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+in\s+(\S.*)$/);
    if (!match) {
      console.error(`bQuery view: Invalid bq-for expression "${expression}"`);
      return;
    }

    const [, itemName, indexName, listExpression] = match;

    // Resolve transition configuration once — the companion attributes are
    // static on the template element (read before it is replaced below).
    // `bq-animate="flip"` enables FLIP move transitions on reorder; `bq-in` /
    // `bq-out` / `bq-transition` drive per-item enter/leave animations.
    const flipEnabled = el.getAttribute(`${prefix}-animate`) === 'flip';
    const itemTransition = resolveTransition(el, prefix);
    const flipDurationAttr = el.getAttribute(`${prefix}-transition-duration`);
    const parsedFlipDuration = flipDurationAttr != null ? Number(flipDurationAttr) : NaN;
    const flipDuration =
      Number.isFinite(parsedFlipDuration) && parsedFlipDuration >= 0
        ? parsedFlipDuration
        : DEFAULT_FLIP_DURATION;
    const flipEasingAttr = el.getAttribute(`${prefix}-transition-easing`);
    const flipEasing =
      flipEasingAttr != null && flipEasingAttr.trim() !== ''
        ? flipEasingAttr.trim()
        : DEFAULT_FLIP_EASING;

    // Skip enter/leave/move animations on the initial render so the first paint
    // of a list is not animated en masse.
    let firstRender = true;

    // Extract :key attribute if present
    const keyExpression = el.getAttribute(':key') || el.getAttribute(`${prefix}-key`);

    const template = el.cloneNode(true) as Element;
    template.removeAttribute(`${prefix}-for`);
    template.removeAttribute(':key');
    template.removeAttribute(`${prefix}-key`);

    // Create placeholder comment
    const placeholder = document.createComment(`bq-for: ${expression}`);
    parent.replaceChild(placeholder, el);

    // Track rendered items by key for reconciliation
    let renderedItemsMap = new Map<unknown, RenderedItem>();
    let renderedOrder: unknown[] = [];

    // Remember which duplicate keys we have already reported so the warning is
    // emitted once per offending key for the lifetime of this binding rather
    // than on every reactive re-render. Gated behind the dev environment so it
    // never reaches production consoles.
    const warnedDuplicateKeys = new Set<unknown>();

    /**
     * Creates a new DOM element for an item.
     */
    const createItemElement = (item: unknown, index: number, key: unknown): RenderedItem => {
      const clone = template.cloneNode(true) as Element;
      const itemCleanups: CleanupFn[] = [];

      // Create reactive signals for item and index
      const itemSig = signal(item);
      const indexSig = indexName ? signal(index) : null;

      const childContext: BindingContext = {
        ...context,
        [itemName]: itemSig,
      };
      if (indexName && indexSig) {
        childContext[indexName] = indexSig;
      }

      // Process bindings on the clone
      const shouldProcessChildren = processElement(
        clone,
        childContext,
        prefix,
        itemCleanups
      );
      if (shouldProcessChildren) {
        processChildren(clone, childContext, prefix, itemCleanups);
      }

      return {
        key,
        element: clone,
        cleanups: itemCleanups,
        item,
        index,
        itemSignal: itemSig,
        indexSignal: indexSig,
      };
    };

    /**
     * Removes a rendered item and cleans up its effects. When `animateLeave`
     * is set and a leave transition is configured, reactivity is torn down
     * immediately but DOM removal is deferred until the leave animation
     * finishes (the item is already untracked, so it is never re-matched).
     */
    const removeItem = (rendered: RenderedItem, animateLeave: boolean): void => {
      for (const cleanup of rendered.cleanups) {
        cleanup();
      }
      if (animateLeave && itemTransition?.leave) {
        void runTransition(rendered.element, itemTransition.leave, itemTransition, 'forwards').then(
          () => {
            rendered.element.remove();
          }
        );
      } else {
        rendered.element.remove();
      }
    };

    /**
     * Updates an existing item's data and index when reused.
     * Updates the reactive signals so bindings re-render.
     */
    const updateItem = (rendered: RenderedItem, newItem: unknown, newIndex: number): void => {
      // Update item if it changed
      if (!Object.is(rendered.item, newItem)) {
        rendered.item = newItem;
        rendered.itemSignal.value = newItem;
      }

      // Update index if it changed
      if (rendered.index !== newIndex) {
        rendered.index = newIndex;
        if (rendered.indexSignal) {
          rendered.indexSignal.value = newIndex;
        }
      }
    };

    const cleanup = effect(() => {
      const list = evaluate<unknown[]>(listExpression, context);

      if (!Array.isArray(list)) {
        // Clear all if list is invalid (no leave animation on teardown)
        for (const rendered of renderedItemsMap.values()) {
          removeItem(rendered, false);
        }
        renderedItemsMap.clear();
        renderedOrder = [];
        return;
      }

      // FLIP move: capture current positions of all rendered elements before
      // any DOM mutation so surviving elements can animate from old → new.
      // Skipped under reduced motion (the underlying motion `flip()` has no
      // such guard, so we gate it here to honour the shared preference).
      const flipPositions: Map<Element, ElementBounds> | null =
        flipEnabled && !firstRender && !prefersReducedMotion() ? new Map() : null;
      if (flipPositions) {
        for (const rendered of renderedItemsMap.values()) {
          flipPositions.set(rendered.element, capturePosition(rendered.element));
        }
      }

      // Build new key order and detect changes
      const newKeys: unknown[] = [];
      const newItemsByKey = new Map<unknown, { item: unknown; index: number }>();
      const seenKeys = new Set<unknown>();

      list.forEach((item, index) => {
        let key = getItemKey(item, index, keyExpression, itemName, indexName, context);

        // Detect duplicate keys - warn developer (once per key, dev only) and
        // fall back to a deterministic unique composite key so reconciliation
        // never corrupts rendered output.
        if (seenKeys.has(key)) {
          if (detectDevEnvironment() && !warnedDuplicateKeys.has(key)) {
            warnedDuplicateKeys.add(key);
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
              console.warn(
                `bq-for: Duplicate key "${String(key)}" detected at index ${index}. ` +
                  `Falling back to a composite key for this item. ` +
                  `Ensure :key expressions produce unique values for each item.`
              );
            }
          }
          // Create a deterministic, primitive composite key to avoid corrupting
          // rendered output. Using a stable string (NUL-sentinel + index + the
          // original key) — rather than a fresh object — keeps the fallback key
          // referentially stable across re-renders, so a duplicated row reuses
          // its DOM node instead of being recreated on every update. The
          // sentinel prefix keeps it from colliding with author-provided keys.
          key = ` bq-dup ${index} ${String(key)}`;
        }
        seenKeys.add(key);

        newKeys.push(key);
        newItemsByKey.set(key, { item, index });
      });

      // Identify items to remove (in old but not in new)
      const keysToRemove: unknown[] = [];
      for (const key of renderedOrder) {
        if (!newItemsByKey.has(key)) {
          keysToRemove.push(key);
        }
      }

      // Remove deleted items (animate the leave unless this is the first render)
      for (const key of keysToRemove) {
        const rendered = renderedItemsMap.get(key);
        if (rendered) {
          removeItem(rendered, !firstRender);
          renderedItemsMap.delete(key);
        }
      }

      // Process new list: create new items, update indices, reorder
      const newRenderedMap = new Map<unknown, RenderedItem>();
      let lastInsertedElement: Element | Comment = placeholder;

      for (let i = 0; i < newKeys.length; i++) {
        const key = newKeys[i];
        const { item, index } = newItemsByKey.get(key)!;
        let rendered = renderedItemsMap.get(key);

        if (rendered) {
          // Reuse existing element
          updateItem(rendered, item, index);
          newRenderedMap.set(key, rendered);

          // Check if element needs to be moved
          const currentNext: ChildNode | null = lastInsertedElement.nextSibling;
          if (currentNext !== rendered.element) {
            // Move element to correct position
            lastInsertedElement.after(rendered.element);
          }
          lastInsertedElement = rendered.element;
        } else {
          // Create new element
          rendered = createItemElement(item, index, key);
          newRenderedMap.set(key, rendered);

          // Insert at correct position
          lastInsertedElement.after(rendered.element);
          lastInsertedElement = rendered.element;

          // Animate the item's entrance (skip on the initial render)
          if (itemTransition?.enter && !firstRender) {
            void runTransition(rendered.element, itemTransition.enter, itemTransition, 'none');
          }
        }
      }

      // FLIP move: now that the DOM has settled, animate surviving elements
      // from their captured positions to their new ones. New elements are not
      // in the captured set (they enter-animate instead).
      if (flipPositions) {
        for (const rendered of newRenderedMap.values()) {
          const firstBounds = flipPositions.get(rendered.element);
          if (firstBounds) {
            void flip(rendered.element, firstBounds, {
              duration: flipDuration,
              easing: flipEasing,
            });
          }
        }
      }

      // Update tracking state
      renderedItemsMap = newRenderedMap;
      renderedOrder = newKeys;
      firstRender = false;
    });

    // When the bq-for itself is cleaned up, also cleanup all rendered items
    cleanups.push(() => {
      cleanup();
      for (const rendered of renderedItemsMap.values()) {
        for (const itemCleanup of rendered.cleanups) {
          itemCleanup();
        }
      }
      renderedItemsMap.clear();
    });
  };
};
