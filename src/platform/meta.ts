/**
 * Document title and meta helpers.
 *
 * @module bquery/platform
 */

import { getBqueryConfig } from './config';

/** Meta tag definition. */
export interface PageMetaTag {
  /** Standard meta name attribute. */
  name?: string;
  /** Open Graph / custom property attribute. */
  property?: string;
  /** http-equiv attribute. */
  httpEquiv?: string;
  /** Meta tag content. */
  content: string;
}

/** Link tag definition. */
export interface PageLinkTag {
  /** Link relation. */
  rel: string;
  /** Link URL. */
  href: string;
  /** Optional type attribute. */
  type?: string;
  /** Optional media query. */
  media?: string;
  /** Optional crossOrigin attribute. */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

/** Page metadata definition. */
export interface PageMetaDefinition {
  /** Document title. */
  title?: string;
  /** Convenience shortcut for the description meta tag. */
  description?: string;
  /** Additional meta tags. */
  meta?: PageMetaTag[];
  /** Additional link tags. */
  link?: PageLinkTag[];
  /** Attributes applied to the html element. */
  htmlAttributes?: Record<string, string>;
  /** Attributes applied to the body element. */
  bodyAttributes?: Record<string, string>;
}

/** Cleanup function returned by definePageMeta(). */
export type PageMetaCleanup = () => void;

const setAttributes = (target: HTMLElement, attributes: Record<string, string>): (() => void) => {
  const previousValues = new Map<string, string | null>();

  for (const [name, value] of Object.entries(attributes)) {
    previousValues.set(name, target.getAttribute(name));
    target.setAttribute(name, value);
  }

  return () => {
    for (const [name, value] of previousValues.entries()) {
      if (value == null) {
        target.removeAttribute(name);
      } else {
        target.setAttribute(name, value);
      }
    }
  };
};

const createElement = <T extends 'meta' | 'link'>(
  tagName: T,
  attributes: Record<string, string | undefined>
): HTMLElementTagNameMap[T] => {
  const element = document.createElement(tagName);
  element.setAttribute('data-bquery-page-meta', 'true');

  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      element.setAttribute(name, value);
    }
  }

  return element;
};

/**
 * Apply document metadata for the current page.
 *
 * @param definition - Title, meta tags, link tags, and document attributes
 * @returns Cleanup function that restores the previous document state
 *
 * @example
 * ```ts
 * const cleanup = definePageMeta({
 *   title: 'Dashboard',
 *   description: 'Overview of your account',
 * });
 * ```
 */
export const definePageMeta = (definition: PageMetaDefinition): PageMetaCleanup => {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const config = getBqueryConfig().pageMeta;
  const title = definition.title
    ? config?.titleTemplate
      ? config.titleTemplate(definition.title)
      : definition.title
    : undefined;

  const inserted: HTMLElement[] = [];
  const restoreFns: Array<() => void> = [];
  const previousTitle = document.title;

  if (title !== undefined) {
    document.title = title;
  }

  const metaEntries = [...(definition.meta ?? [])];
  if (definition.description) {
    metaEntries.unshift({ name: 'description', content: definition.description });
  }

  for (const entry of metaEntries) {
    const meta = createElement('meta', {
      name: entry.name,
      property: entry.property,
      'http-equiv': entry.httpEquiv,
      content: entry.content,
    });
    document.head.appendChild(meta);
    inserted.push(meta);
  }

  for (const entry of definition.link ?? []) {
    const link = createElement('link', {
      rel: entry.rel,
      href: entry.href,
      type: entry.type,
      media: entry.media,
      crossorigin: entry.crossOrigin,
    });
    document.head.appendChild(link);
    inserted.push(link);
  }

  if (definition.htmlAttributes) {
    restoreFns.push(setAttributes(document.documentElement, definition.htmlAttributes));
  }

  if (definition.bodyAttributes && document.body) {
    restoreFns.push(setAttributes(document.body, definition.bodyAttributes));
  }

  return () => {
    document.title = previousTitle;
    for (const restore of restoreFns.reverse()) {
      restore();
    }
    for (const element of inserted) {
      element.remove();
    }
  };
};
