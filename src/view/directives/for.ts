import { effect, signal, type CleanupFn, type Signal } from '../../reactive/index';
import { evaluate } from '../evaluate';
import type { BindingContext, DirectiveHandler } from '../types';

type ProcessElementFn = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[]
) => void;

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
      processElement(clone, childContext, prefix, itemCleanups);
      processChildren(clone, childContext, prefix, itemCleanups);

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
     * Removes a rendered item and cleans up its effects.
     */
    const removeItem = (rendered: RenderedItem): void => {
      for (const cleanup of rendered.cleanups) {
        cleanup();
      }
      rendered.element.remove();
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
        // Clear all if list is invalid
        for (const rendered of renderedItemsMap.values()) {
          removeItem(rendered);
        }
        renderedItemsMap.clear();
        renderedOrder = [];
        return;
      }

      // Build new key order and detect changes
      const newKeys: unknown[] = [];
      const newItemsByKey = new Map<unknown, { item: unknown; index: number }>();
      const seenKeys = new Set<unknown>();

      list.forEach((item, index) => {
        let key = getItemKey(item, index, keyExpression, itemName, indexName, context);

        // Detect duplicate keys - warn developer and fall back to unique composite key
        if (seenKeys.has(key)) {
          console.warn(
            `bq-for: Duplicate key "${String(key)}" detected at index ${index}. ` +
              `Falling back to index-based key for this item. ` +
              `Ensure :key expressions produce unique values for each item.`
          );
          // Create a unique composite key to avoid corrupting rendered output
          key = { __bqDuplicateKey: key, __bqIndex: index };
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

      // Remove deleted items
      for (const key of keysToRemove) {
        const rendered = renderedItemsMap.get(key);
        if (rendered) {
          removeItem(rendered);
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
        }
      }

      // Update tracking state
      renderedItemsMap = newRenderedMap;
      renderedOrder = newKeys;
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
