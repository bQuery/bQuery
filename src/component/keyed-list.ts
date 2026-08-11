/**
 * `keyedList` — keyed list rendering helper for component templates.
 *
 * Produces a string of repeated child markup with `data-bq-key="<key>"`
 * annotations on the immediate top-level wrapper of each item. The keys are
 * preserved through sanitization (data attributes are allow-listed by default)
 * and enable {@link reconcileKeyed} to reorder existing DOM nodes after a
 * re-render instead of throwing away every child.
 *
 * Typical usage:
 *
 * ```ts
 * component('todo-list', {
 *   state: { items: [] as { id: string; text: string }[] },
 *   render({ state }) {
 *     return html`
 *       <ul>
 *         ${keyedList(state.items, (item) => item.id, (item) =>
 *           html`<li>${item.text}</li>`)}
 *       </ul>
 *     `;
 *   },
 *   updated() {
 *     const items = this.getState<Array<{ id: string }>>('items');
 *     reconcileKeyed(this.shadowRoot!.querySelector('ul')!, items.map((item) => item.id));
 *   },
 * });
 * ```
 *
 * @module bquery/component
 */

const DEFAULT_KEY_ATTR = 'data-bq-key';

const escapeForAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Render a list of items with stable identity keys baked into the generated
 * markup. Each item's rendered output must start with a single top-level
 * element; the key attribute is injected into that element's opening tag.
 */
export const keyedList = <T>(
  items: readonly T[],
  keyFn: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => string
): string => {
  let out = '';
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const key = String(keyFn(item, i));
    const rendered = renderItem(item, i);
    // Inject `data-bq-key="..."` into the first opening tag.
    const match = /^\s*<([a-zA-Z][a-zA-Z0-9_-]*)([\s>])/.exec(rendered);
    if (!match) {
      out += rendered;
      continue;
    }
    const insertAt = match.index + match[0].length - 1;
    const safeKey = escapeForAttr(key);
    out =
      out +
      rendered.slice(0, insertAt) +
      ` ${DEFAULT_KEY_ATTR}="${safeKey}"` +
      rendered.slice(insertAt);
  }
  return out;
};

/**
 * After a re-render, reorder direct children of `container` to match the order
 * of the provided key list (typically derived from the current state), preserving
 * any descendant DOM state (focus, scroll, custom-element internals) for items
 * whose key did not change.
 *
 * This is a best-effort, minimal reconciler: it works when the parent's
 * rendered children all have `data-bq-key` set (as produced by {@link keyedList}).
 *
 * Returns the number of nodes that were repositioned (0 if the order was
 * already correct).
 */
export const reconcileKeyed = (
  container: Element,
  desiredKeys?: readonly (string | number)[]
): number => {
  const children = Array.from(container.children).filter((el) => el.hasAttribute(DEFAULT_KEY_ATTR));
  if (children.length < 2) return 0;

  const nextKeyedSibling = (node: Element): Element | null => {
    let sibling = node.nextElementSibling;
    while (sibling && !sibling.hasAttribute(DEFAULT_KEY_ATTR)) {
      sibling = sibling.nextElementSibling;
    }
    return sibling;
  };

  const byKey = new Map<string, Element>();
  for (const child of children) {
    const key = child.getAttribute(DEFAULT_KEY_ATTR);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, child);
  }

  const targetKeys = (desiredKeys ?? Array.from(byKey.keys())).map((key) => String(key));
  const seen = new Set<string>();
  const ordered: Element[] = [];
  for (const key of targetKeys) {
    if (seen.has(key)) continue;
    const child = byKey.get(key);
    if (!child) continue;
    seen.add(key);
    ordered.push(child);
  }
  if (ordered.length < 2) return 0;

  let moved = 0;
  let reference: Element | null = children[0];
  for (const child of ordered) {
    if (reference !== child) {
      container.insertBefore(child, reference);
      moved += 1;
    }
    reference = nextKeyedSibling(child);
  }
  return moved;
};
