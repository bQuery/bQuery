/**
 * In-place DOM patching for component re-renders.
 *
 * A re-render parses the new (already sanitized) markup into an inert
 * `<template>` and morphs the live tree into it instead of replacing
 * `innerHTML`. Matching nodes are reused, so form-control values, focus,
 * caret/selection, scroll position, media playback and nested custom-element
 * state survive an unrelated update.
 *
 * Attributes are diffed against the markup the component rendered *last time*
 * rather than against the live DOM, like a virtual-DOM patch: the template only
 * owns what it wrote. An attribute added at runtime (`<details open>` toggled
 * by the user, a class set by an animation) is left alone, and an attribute the
 * template keeps unchanged is not re-asserted — not even when it was removed
 * at runtime (a user-collapsed `<details open>` stays collapsed).
 *
 * Children are matched by tag and key — `data-bq-key` (see `keyedList()`)
 * or `id` — and otherwise by position, with a bounded lookahead so a node
 * inserted or removed in front of a sibling does not shift every later match.
 *
 * @module bquery/component
 * @internal
 */

/** Text content of a `<textarea>` as last rendered, stored next to the attributes. */
const TEXTAREA_TEXT = '#text';

/**
 * Attributes (and textarea text) each live element had in the last rendered
 * markup. Weakly held so removed nodes are collected.
 */
const renderedAttributes = new WeakMap<Element, Map<string, string>>();

const snapshotAttributes = (element: Element): Map<string, string> => {
  const snapshot = new Map<string, string>();
  for (const attr of Array.from(element.attributes)) {
    snapshot.set(attr.name, attr.value);
  }
  if (element.localName === 'textarea') {
    snapshot.set(TEXTAREA_TEXT, element.textContent ?? '');
  }
  return snapshot;
};

/**
 * Custom elements whose children came from the template (slotted content).
 * A custom element without template children may render its own light DOM
 * (`shadow: false`), and that DOM is not the parent template's to remove.
 */
const templateOwnsChildren = new WeakSet<Element>();

/**
 * Hosts that render into their own light DOM (bQuery `shadow: false`
 * components, registered by the component on render). Their children are their
 * own render output, never the parent template's, so a parent re-render leaves
 * them alone even when the parent template supplied placeholder children.
 *
 * @internal
 */
export const selfRenderedHosts = new WeakSet<Element>();

const isCustomElement = (element: Element): boolean => element.localName.includes('-');

const recordChildOwnership = (element: Element, source: Element): void => {
  if (!isCustomElement(element)) return;
  if (source.hasChildNodes()) templateOwnsChildren.add(element);
  else templateOwnsChildren.delete(element);
};

/** Record the rendered attributes for `root` and every element below it. */
const recordSubtree = (root: Node): void => {
  if (root.nodeType !== 1) return;
  const element = root as Element;
  for (const node of [element, ...Array.from(element.querySelectorAll('*'))]) {
    renderedAttributes.set(node, snapshotAttributes(node));
    recordChildOwnership(node, node);
  }
};

const keyOf = (node: Node): string | null => {
  if (node.nodeType !== 1) return null;
  const element = node as Element;
  const key = element.getAttribute('data-bq-key') ?? element.getAttribute('id');
  return key === null || key === '' ? null : `${element.localName}\u0000${key}`;
};

const isCompatible = (live: Node, next: Node): boolean => {
  if (live.nodeType !== next.nodeType) return false;
  if (live.nodeType !== 1) return true;
  const liveElement = live as Element;
  const nextElement = next as Element;
  return (
    liveElement.localName === nextElement.localName &&
    liveElement.namespaceURI === nextElement.namespaceURI
  );
};

/** Mirror a changed rendered attribute onto the matching form-control property. */
const syncFormProperty = (element: Element, name: string, value: string | null): void => {
  if (name === 'value' && (element.localName === 'input' || element.localName === 'option')) {
    (element as HTMLInputElement).value = value ?? '';
    // For an `<option>` and a checkbox, radio or hidden input the `value`
    // property reflects the content attribute, so the write above put back a
    // `value=""` the template dropped. Without it they fall back to their
    // text / `on`, as freshly parsed markup does.
    if (value === null && element.hasAttribute('value')) element.removeAttribute('value');
  } else if (name === 'checked' && element.localName === 'input') {
    (element as HTMLInputElement).checked = value !== null;
  } else if (name === 'selected' && element.localName === 'option') {
    (element as HTMLOptionElement).selected = value !== null;
  }
};

const morphAttributes = (live: Element, next: Element): void => {
  const previous = renderedAttributes.get(live) ?? snapshotAttributes(live);
  const current = snapshotAttributes(next);

  for (const [name, value] of current) {
    if (name === TEXTAREA_TEXT) continue;
    // Unchanged since the last render: leave the live value alone, including
    // a runtime removal (e.g. a collapsed `<details open>`).
    if (previous.get(name) === value) continue;
    if (live.getAttribute(name) !== value) {
      live.setAttribute(name, value);
    }
    if (previous.get(name) !== value) syncFormProperty(live, name, value);
  }
  for (const name of previous.keys()) {
    if (name === TEXTAREA_TEXT || current.has(name)) continue;
    if (live.hasAttribute(name)) live.removeAttribute(name);
    syncFormProperty(live, name, null);
  }

  renderedAttributes.set(live, current);
};

const morphNode = (live: Node, next: Node): void => {
  if (live.nodeType !== 1) {
    if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue;
    return;
  }

  const liveElement = live as Element;
  const nextElement = next as Element;
  const previousText = renderedAttributes.get(liveElement)?.get(TEXTAREA_TEXT);
  morphAttributes(liveElement, nextElement);

  if (liveElement.localName === 'textarea') {
    // The text child is only the default value; the typed value lives in the
    // `value` property and must survive unless the template changed it.
    const nextText = nextElement.textContent ?? '';
    if (previousText !== nextText) {
      liveElement.textContent = nextText;
      (liveElement as HTMLTextAreaElement).value = nextText;
    }
    return;
  }

  if (liveElement.localName === 'template') {
    const liveContent = (liveElement as HTMLTemplateElement).content;
    const nextContent = (nextElement as HTMLTemplateElement).content;
    liveContent.replaceChildren(...Array.from(nextContent.cloneNode(true).childNodes));
    return;
  }

  // A custom element's own rendering (light DOM of a `shadow: false`
  // component) is left alone unless the template supplies — or used to
  // supply — the children, e.g. content for its slots. A bQuery `shadow: false`
  // component always owns its light DOM, even over placeholder children.
  if (selfRenderedHosts.has(liveElement)) return;
  if (
    isCustomElement(liveElement) &&
    !nextElement.hasChildNodes() &&
    !templateOwnsChildren.has(liveElement)
  ) {
    return;
  }
  recordChildOwnership(liveElement, nextElement);
  morphChildren(liveElement, nextElement);
};

/** Elements whose own state (value, playback, a loaded frame) a recreation loses. */
const STATEFUL_ELEMENTS = 'input,textarea,select,video,audio,iframe';

/**
 * Whether recreating `node` would lose state: a form control, media element,
 * frame or custom element, or an element holding a form control, media or
 * frame.
 */
const holdsState = (node: Node): boolean => {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return (
    isCustomElement(element) ||
    element.matches(STATEFUL_ELEMENTS) ||
    element.querySelector(STATEFUL_ELEMENTS) !== null
  );
};

/** How many source siblings the positional matcher looks ahead. */
const LOOKAHEAD = 16;

type MovableParent = ParentNode &
  Node & { moveBefore?: (node: ChildNode, child: ChildNode | null) => void };

/**
 * Move `node` before `child`. Uses the state-preserving `moveBefore()` where
 * the browser has it (a moved custom element gets `connectedMoveCallback`
 * instead of being disconnected and reconnected; focus, media and iframes
 * survive); `insertBefore()` detaches and re-attaches the node otherwise.
 */
const moveNode = (parent: MovableParent, node: ChildNode, child: ChildNode | null): void => {
  if (typeof parent.moveBefore === 'function' && parent.isConnected) {
    try {
      parent.moveBefore(node, child);
      return;
    } catch {
      // e.g. a node from another document — fall back to a plain insert.
    }
  }
  parent.insertBefore(node, child);
};

/** Options for {@link morphChildren}. */
export interface MorphOptions {
  /** Live children for which this returns `true` are left untouched and in place. */
  preserve?: (node: Node) => boolean;
}

/**
 * Morph the children of `target` into the children of `source`. Unmatched
 * source nodes are imported into `target`'s document.
 *
 * @internal
 */
export const morphChildren = (
  target: ParentNode & Node,
  source: ParentNode & Node,
  options: MorphOptions = {}
): void => {
  const preserve = options.preserve;
  const isManaged = (node: Node | null): boolean => node !== null && !preserve?.(node);
  const nextManaged = (node: ChildNode | null): ChildNode | null => {
    let current = node;
    while (current && !isManaged(current)) current = current.nextSibling;
    return current;
  };

  const nextChildren = Array.from(source.childNodes);
  const nextKeys = new Set<string>();
  for (const child of nextChildren) {
    const key = keyOf(child);
    if (key !== null) nextKeys.add(key);
  }

  const liveByKey = new Map<string, ChildNode>();
  for (const child of Array.from(target.childNodes)) {
    if (!isManaged(child)) continue;
    const key = keyOf(child);
    if (key !== null && !liveByKey.has(key)) liveByKey.set(key, child);
  }

  const used = new Set<Node>();
  let reference = nextManaged(target.firstChild);

  /**
   * A keyed live node that a later source node will claim. Only the first
   * live node per key can be claimed: a duplicate is never pending, or it
   * would hold the insertion point (and every sibling after it) forever.
   */
  const isPendingKeyed = (node: Node, key = keyOf(node)): boolean =>
    key !== null && nextKeys.has(key) && liveByKey.get(key) === node && !used.has(node);

  const findPositionalMatch = (next: Node): ChildNode | null => {
    // Unkeyed and stale candidates that do not fit count against a budget, so
    // a source run that matches nothing (`<li>` rows becoming `<div>` rows)
    // costs O(n · LOOKAHEAD) instead of scanning every remaining live node.
    let budget = LOOKAHEAD;
    for (let candidate = reference; candidate; candidate = nextManaged(candidate.nextSibling)) {
      if (used.has(candidate)) continue;
      // Text and comments never jump over an element: matching one ahead
      // would skip the insertion point past an element a later source node
      // (e.g. the `<input>` after an inserted message) still needs. Checked
      // before the keyed skip so whitespace between keyed rows does not scan
      // over every pending row.
      if (next.nodeType !== 1 && candidate.nodeType === 1) return null;
      // A keyed node waits for the source node carrying its key.
      const candidateKey = keyOf(candidate);
      if (isPendingKeyed(candidate, candidateKey)) continue;
      if (candidateKey === null && isCompatible(candidate, next)) return candidate;
      if (--budget === 0) return null;
    }
    return null;
  };

  /** Length (capped) of the run of compatible pairs from `source[index]` / `live`. */
  const runLength = (index: number, live: ChildNode | null): number => {
    let length = 0;
    while (
      length < LOOKAHEAD &&
      live &&
      index + length < nextChildren.length &&
      isCompatible(live, nextChildren[index + length])
    ) {
      length++;
      live = nextManaged(live.nextSibling);
    }
    return length;
  };

  /**
   * `match`, for `nextChildren[index]`, lies ahead of `reference`. Taking it
   * skips the live nodes in between, which can then only be removed. Keep
   * `reference` instead (insert or move in front of it) when it lines up with
   * a later source node over a longer run than `match` does here — e.g. an
   * element inserted before an `<input>`: the input and what follows it stay
   * put.
   *
   * On a tie one node is recreated either way, so keep the one that holds
   * state (see `holdsState`): a hint below an `<input>` turning into an error
   * above it recreates the message, not the input — in both directions. A
   * stateful node still gives way when it belongs elsewhere: an `anchor` that
   * a live node further ahead lines up with better (it is being removed), or a
   * `match` that lines up with a later source node at least as well.
   */
  const keepsReference = (index: number, match: ChildNode): boolean => {
    const anchor = reference as ChildNode;
    if (keyOf(anchor) !== null) return false;
    const limit = Math.min(nextChildren.length, index + 1 + LOOKAHEAD);
    /** The later unkeyed source node `node` lines up with longest: [run, index]. */
    const bestLater = (node: ChildNode): [number, number] => {
      let best = 0;
      let at = -1;
      for (let later = index + 1; later < limit; later++) {
        const source = nextChildren[later];
        if (keyOf(source) !== null || !isCompatible(node, source)) continue;
        const run = runLength(later, node);
        if (run > best) {
          best = run;
          at = later;
        }
      }
      return [best, at];
    };

    const [anchorRun, anchorAt] = bestLater(anchor);
    if (anchorRun === 0) return false;
    const matchRun = 1 + runLength(index + 1, nextManaged(match.nextSibling));
    if (anchorRun !== matchRun) return anchorRun > matchRun;

    if (!holdsState(anchor) && holdsState(match)) return bestLater(match)[0] >= matchRun;
    const target = nextChildren[anchorAt];
    let live = nextManaged(match.nextSibling);
    for (let steps = 0; live && steps < LOOKAHEAD; steps++) {
      if (
        keyOf(live) === null &&
        isCompatible(live, target) &&
        runLength(anchorAt, live) > anchorRun
      ) {
        return false;
      }
      live = nextManaged(live.nextSibling);
    }
    return true;
  };

  const isAhead = (match: ChildNode): boolean =>
    reference !== null &&
    match !== reference &&
    (reference.compareDocumentPosition(match) & 4) /* DOCUMENT_POSITION_FOLLOWING */ !== 0;

  // Moving a node detaches it, which blurs a focused control and restarts
  // media and transitions, so prefer leaving a match where it is: when it lies
  // ahead, skip the insertion point past it (the nodes in between are either
  // claimed later or removed at the end). Move it back only when the node at
  // the insertion point is itself waiting for a later key, or lines up better
  // with later source nodes (see `keepsReference`).
  const placeMatch = (match: ChildNode, moveBack: boolean): void => {
    if (match === reference) {
      reference = nextManaged(match.nextSibling);
      return;
    }
    if (isAhead(match) && !moveBack && !isPendingKeyed(reference as ChildNode)) {
      reference = nextManaged(match.nextSibling);
      return;
    }
    moveNode(target, match, reference);
  };

  for (let index = 0; index < nextChildren.length; index++) {
    const next = nextChildren[index];
    const key = keyOf(next);
    let match: ChildNode | null = null;
    if (key !== null) {
      const candidate = liveByKey.get(key);
      if (candidate && !used.has(candidate) && isCompatible(candidate, next)) match = candidate;
    } else {
      match = findPositionalMatch(next);
    }

    let moveBack = false;
    if (
      match &&
      isAhead(match) &&
      !isPendingKeyed(reference as ChildNode) &&
      keepsReference(index, match)
    ) {
      // A keyed node is moved back (keys promise identity); an unkeyed source
      // node is created fresh instead of stealing a node further ahead.
      if (key === null) match = null;
      else moveBack = true;
    }

    if (match) {
      used.add(match);
      morphNode(match, next);
      placeMatch(match, moveBack);
      continue;
    }

    const ownerDocument = target.ownerDocument ?? document;
    const created = ownerDocument.importNode(next, true);
    recordSubtree(created);
    used.add(created);
    target.insertBefore(created, reference);
  }

  for (const child of Array.from(target.childNodes)) {
    if (isManaged(child) && !used.has(child)) child.remove();
  }
};

/**
 * Patch `root`'s children to match `markup`. `markup` must already be
 * sanitized; `toSink` wraps it for an enforced Trusted Types CSP.
 *
 * @internal
 */
export const morphInnerHtml = (
  root: ParentNode & Node,
  markup: string,
  toSink: (html: string) => string,
  options: MorphOptions = {}
): void => {
  const ownerDocument = root.ownerDocument ?? document;
  const template = ownerDocument.createElement('template');
  template.innerHTML = toSink(markup);
  morphChildren(root, template.content, options);
};
