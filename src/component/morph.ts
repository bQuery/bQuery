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
 * template keeps unchanged is not re-asserted.
 *
 * Children are matched by tag and key — `data-bq-key` (see `keyedList()`)
 * or `id` — and otherwise by position.
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

/** Record the rendered attributes for `root` and every element below it. */
const recordSubtree = (root: Node): void => {
  if (root.nodeType !== 1) return;
  const element = root as Element;
  renderedAttributes.set(element, snapshotAttributes(element));
  for (const descendant of Array.from(element.querySelectorAll('*'))) {
    renderedAttributes.set(descendant, snapshotAttributes(descendant));
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
    if (previous.get(name) === value && live.hasAttribute(name)) continue;
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

  morphChildren(liveElement, nextElement);
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

  const findPositionalMatch = (next: Node): ChildNode | null => {
    for (let candidate = reference; candidate; candidate = nextManaged(candidate.nextSibling)) {
      if (used.has(candidate)) continue;
      const candidateKey = keyOf(candidate);
      // A keyed node waits for the source node carrying its key.
      if (candidateKey !== null && nextKeys.has(candidateKey)) continue;
      if (candidateKey === null && isCompatible(candidate, next)) return candidate;
    }
    return null;
  };

  /** A keyed live node that a later source node will claim. */
  const isPendingKeyed = (node: Node): boolean => {
    const key = keyOf(node);
    return key !== null && nextKeys.has(key) && !used.has(node);
  };

  // Moving a node detaches it, which blurs a focused control and restarts
  // media and transitions, so prefer leaving a match where it is: when it lies
  // ahead, skip the insertion point past it (the nodes in between are either
  // claimed later or removed at the end). Only move it back when the node at
  // the insertion point is itself waiting for a later key.
  const placeMatch = (match: ChildNode): void => {
    if (match === reference) {
      reference = nextManaged(match.nextSibling);
      return;
    }
    const ahead =
      reference !== null &&
      (reference.compareDocumentPosition(match) & 4) /* DOCUMENT_POSITION_FOLLOWING */ !== 0;
    if (ahead && !isPendingKeyed(reference as ChildNode)) {
      reference = nextManaged(match.nextSibling);
      return;
    }
    target.insertBefore(match, reference);
  };

  for (const next of nextChildren) {
    const key = keyOf(next);
    let match: ChildNode | null = null;
    if (key !== null) {
      const candidate = liveByKey.get(key);
      if (candidate && !used.has(candidate) && isCompatible(candidate, next)) match = candidate;
    } else {
      match = findPositionalMatch(next);
    }

    if (match) {
      used.add(match);
      morphNode(match, next);
      placeMatch(match);
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
