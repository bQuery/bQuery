/**
 * Suspense-style out-of-order streaming for SSR.
 *
 * Renders the synchronous shell with `defer(...)` placeholders wrapped in
 * `<bq-slot id="bq-s-N">…</bq-slot>` markers, flushes that initial chunk,
 * then streams a `<template id="bq-r-N">…</template>` plus a tiny inline
 * patch script for every resolved promise. The patch script swaps the
 * template content into the placeholder and removes both.
 *
 * Honours `SSRContext.signal` for cancellation and propagates the context
 * nonce onto every emitted `<script>` tag for CSP-strict environments.
 *
 * @module bquery/ssr
 */

import { isComputed, isSignal, type Signal } from '../reactive/index';
import type { BindingContext } from '../view/types';
import { createSSRContext, type SSRContext } from './context';
import { DEFER_BRAND } from './defer-brand';
import { parseTemplate, serializeTree, type SSRElement, type SSRNode } from './html-parser';
import { renderToString } from './render';
import type { AsyncRenderOptions } from './render-async';

interface DeferredLike<T = unknown> {
  [DEFER_BRAND]: true;
  promise: Promise<T>;
  fallback?: unknown;
}

const isDeferredLike = (value: unknown): value is DeferredLike =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<symbol, unknown>)[DEFER_BRAND] === true;

const isReactive = (value: unknown): boolean => isSignal(value) || isComputed(value);

/** A single slot collected by `renderToStreamSuspense`. */
interface SuspenseSlot {
  id: string;
  key: string;
  promise: Promise<unknown>;
}

type SettledSuspenseSlot =
  | { index: number; slot: SuspenseSlot; ok: true; value: unknown }
  | { index: number; slot: SuspenseSlot; ok: false; error: unknown };

/**
 * Whitelist regex for slot/template IDs. The IDs end up inside an inline
 * `<script>` patch, and while `escapeScriptBody()` already protects against
 * `</script>` injection, validating the prefix at the boundary is defense in
 * depth. Allows ASCII letters, digits, `-` and `_`.
 */
const SAFE_ID_RE = /^[A-Za-z][\w-]*$/;
/** Enforces a lowercase custom-element-style tag name with a required hyphen. */
const SAFE_SLOT_TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

const sanitizeSlotPrefix = (prefix: string, fallback: string): string => {
  if (typeof prefix !== 'string' || !SAFE_ID_RE.test(prefix)) return fallback;
  return prefix;
};

const sanitizeSlotTag = (tag: string | undefined, fallback: string): string => {
  if (typeof tag !== 'string' || !SAFE_SLOT_TAG_RE.test(tag)) return fallback;
  return tag;
};

/**
 * Derives a template ID prefix that cannot collide with placeholder slot IDs.
 * The default `bq-s` becomes `bq-r`; custom prefixes without that suffix get
 * `-r` appended, so `slot` produces `slot-r` instead of a duplicate `slot`.
 * Prefixes already ending in `-r` get `-template` to avoid `-r-r`.
 */
const getResolvedIdPrefix = (slotIdPrefix: string): string => {
  const candidate = slotIdPrefix.replace(/-s$/, '-r');
  if (candidate === slotIdPrefix && slotIdPrefix.endsWith('-r')) {
    return `${slotIdPrefix}-template`;
  }
  return candidate === slotIdPrefix ? `${slotIdPrefix}-r` : candidate;
};

/**
 * Build a synchronous rendering context where every `defer(...)` value is
 * replaced by a placeholder string and every other Promise/loader is
 * replaced by its fallback (`undefined`). The deferred values are recorded
 * so the streaming loop can resolve them after the shell flushes.
 */
const splitDeferred = (
  context: BindingContext,
  prefix: string
): { syncContext: BindingContext; slots: SuspenseSlot[] } => {
  const syncContext: BindingContext = {};
  const slots: SuspenseSlot[] = [];
  let counter = 0;
  for (const [key, value] of Object.entries(context)) {
    if (isReactive(value)) {
      syncContext[key] = value as Signal<unknown>;
      continue;
    }
    if (isDeferredLike(value)) {
      const id = `${prefix}-${counter++}`;
      slots.push({ id, key, promise: value.promise });
      // Render with the fallback so the synchronous shell has *something*.
      syncContext[key] = value.fallback;
      continue;
    }
    if (value && typeof (value as Promise<unknown>).then === 'function') {
      // Bare promises become deferred slots without a fallback.
      const id = `${prefix}-${counter++}`;
      slots.push({ id, key, promise: value as Promise<unknown> });
      syncContext[key] = undefined;
      continue;
    }
    syncContext[key] = value;
  }
  return { syncContext, slots };
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, '&quot;');

const escapeScriptBody = (s: string): string =>
  s
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/**
 * Options for `renderToStreamSuspense`.
 *
 * Only `context`, `prefix`, `stripDirectives`, and `annotateHydration` are
 * inherited from the base async render options. Head/store injection and other
 * response-shaping options are intentionally unsupported here.
 */
export interface SuspenseStreamOptions
  extends Pick<AsyncRenderOptions, 'context' | 'prefix' | 'stripDirectives' | 'annotateHydration'> {
  /**
   * Prefix used for slot/template IDs. Default: `'bq-s'` for placeholders
   * and `'bq-r'` for resolved templates.
   */
  slotIdPrefix?: string;
  /**
   * Tag name used for the placeholder element. Default: `'bq-slot'`.
   * Must be a valid custom-element tag (contain a `-`) so the browser keeps
   * inner content intact.
   */
  slotTag?: string;
}

/**
 * Static patch script for streamed Suspense fragments.
 *
 * The server passes the variable slot/template IDs through escaped
 * `data-bq-slot` / `data-bq-template` attributes on the `<script>` tag, and
 * the script reads them from `document.currentScript`. This keeps the emitted
 * code body constant while still letting each streamed patch target a
 * different placeholder/template pair.
 */
const PATCH_SCRIPT_BODY = escapeScriptBody(
  '(()=>{var c=document.currentScript;if(!c)return;var slotId=c.getAttribute("data-bq-slot");var templateId=c.getAttribute("data-bq-template");if(!slotId||!templateId)return;var s=document.getElementById(slotId);var t=document.getElementById(templateId);if(!s||!t)return;var f=t.content?t.content.cloneNode(true):t;while(s.firstChild)s.removeChild(s.firstChild);s.appendChild(f);t.parentNode&&t.parentNode.removeChild(t);s.parentNode&&s.replaceWith(...s.childNodes);})();'
);

const buildPatchScript = (slotId: string, resolvedId: string, nonce?: string): string => {
  const nonceAttr = nonce ? ` nonce="${escapeAttr(nonce)}"` : '';
  return `<script${nonceAttr} data-bq-slot="${escapeAttr(slotId)}" data-bq-template="${escapeAttr(resolvedId)}">${PATCH_SCRIPT_BODY}</script>`;
};

const renderResolvedFragment = (
  _template: string,
  fullContext: BindingContext,
  syncContext: BindingContext,
  key: string,
  resolved: unknown,
  options: SuspenseStreamOptions
): string => {
  // Re-render only the wrapping placeholder content. We use the original
  // template if the user provided a slot template via context (`__suspense_<key>`)
  // or fall back to a stringification of the resolved value.
  const slotTemplateKey = `__suspense_${key}`;
  const slotTemplate = (fullContext as Record<string, unknown>)[slotTemplateKey];
  if (typeof slotTemplate === 'string') {
    return renderToString(
      slotTemplate,
      { ...syncContext, [key]: resolved },
      {
        prefix: options.prefix,
        stripDirectives: options.stripDirectives,
        annotateHydration: options.annotateHydration,
      }
    ).html;
  }
  // Default: stringify the resolved value (with HTML escaping).
  if (resolved === null || resolved === undefined) return '';
  if (typeof resolved === 'string') return escapeHtml(resolved);
  return escapeHtml(String(resolved));
  // NOTE: the simple template path also serves as a hint for `bq-text`-style
  // bindings; rich nested rendering can be done by passing a slot template.
};

const removeAttr = (el: SSRElement, name: string): void => {
  if (!(name in el.attributes)) return;
  delete el.attributes[name];
  const index = el.attributeOrder.indexOf(name);
  if (index !== -1) el.attributeOrder.splice(index, 1);
};

const createSlotWrapper = (slotTag: string, slotId: string, children: SSRNode[] = []): SSRElement => ({
  type: 'element',
  tag: slotTag,
  attributes: { id: slotId },
  attributeOrder: ['id'],
  children,
  void: false,
  raw: false,
});

const visitElements = (nodes: SSRNode[], visit: (element: SSRElement) => void): void => {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    visit(node);
    visitElements(node.children, visit);
  }
};

const findElementByTag = (nodes: SSRNode[], tag: string): SSRElement | null => {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    if (node.tag === tag) return node;
    const nested = findElementByTag(node.children, tag);
    if (nested) return nested;
  }
  return null;
};

const replaceSlotsInShell = (
  html: string,
  context: BindingContext,
  slots: SuspenseSlot[],
  options: SuspenseStreamOptions
): string => {
  // Wrap the original placeholder text within a `<slotTag>` element so we can
  // patch it on the client. Only the parts that *come from* a deferred value
  // need wrapping; the synchronous renderer already produced them as text
  // (the fallback). We surround the *entire* fallback text in the slot tag.
  // To keep the renderer agnostic, we wrap the resolved value's fallback
  // wherever the renderer placed it. We rely on a marker attribute set by the
  // user (`bq-defer="key"`) to mark where the slot wrapper goes.
  // Without such a marker, the slot fallback is already inlined and we
  // append the resolved templates at the end of <body>.
  const slotTag = sanitizeSlotTag(options.slotTag, 'bq-slot');
  const root = parseTemplate(html);
  const slotsByKey = new Map(slots.map((slot) => [slot.key, slot]));
  const placed = new Set<string>();

  visitElements(root.children, (element) => {
    const marker = element.attributes['data-bq-defer'];
    if (!marker) return;
    removeAttr(element, 'data-bq-defer');
    const slot = slotsByKey.get(marker);
    if (!slot || placed.has(slot.id)) return;
    const wrappedChildren = element.children;
    element.children = [createSlotWrapper(slotTag, slot.id, wrappedChildren)];
    placed.add(slot.id);
  });

  // If we didn't find any markers but slots exist, append placeholders at the
  // end of <body> (or the end of html) so the user can still see updates.
  const body = findElementByTag(root.children, 'body');
  const appendTarget = body?.children ?? root.children;
  for (const slot of slots) {
    if (placed.has(slot.id)) continue;
    appendTarget.push(createSlotWrapper(slotTag, slot.id));
  }
  // `context` reference suppressed to keep the function side-effect free
  // for the static analysis; the render uses syncContext where needed.
  void context;
  return serializeTree(root);
};

/** Returns true for characters that can appear immediately before an attribute name. */
const canPrecedeAttributeName = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/** Returns true for characters that can terminate an attribute name in a start tag. */
const canFollowAttributeName = (ch: string | undefined): boolean =>
  ch === undefined || ch === '=' || ch === '>' || ch === '/' || /\s/.test(ch);

/**
 * Converts author-facing `bq-defer` markers to an internal data attribute
 * before rendering so `stripDirectives` can remove regular `bq-*` directives
 * without losing Suspense slot placement. This is a linear scanner instead of
 * a regex because templates are caller-provided strings.
 */
const protectDeferMarkers = (template: string): string => {
  let out = '';
  let i = 0;
  let inTag = false;
  let quote: '"' | "'" | '' = '';
  let tagNameEnded = false;
  let tagLeadSeen = false;
  let allowAttributeRewrite = true;
  const marker = 'bq-defer';

  while (i < template.length) {
    const ch = template[i];

    if (!inTag) {
      if (ch === '<') {
        inTag = true;
        tagNameEnded = false;
        tagLeadSeen = false;
        allowAttributeRewrite = true;
      }
      out += ch;
      i++;
      continue;
    }

    if (quote) {
      out += ch;
      if (ch === quote) quote = '';
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '>') {
      inTag = false;
      out += ch;
      i++;
      continue;
    }

    if (!tagNameEnded) {
      out += ch;
      i++;

      if (!tagLeadSeen) {
        if (/\s/.test(ch)) continue;
        tagLeadSeen = true;
        if (ch === '/' || ch === '!' || ch === '?') {
          allowAttributeRewrite = false;
        }
        continue;
      }

      if (allowAttributeRewrite && /\s/.test(ch)) {
        tagNameEnded = true;
      }
      continue;
    }

    if (
      allowAttributeRewrite &&
      template.startsWith(marker, i) &&
      canPrecedeAttributeName(template[i - 1]) &&
      canFollowAttributeName(template[i + marker.length])
    ) {
      out += 'data-bq-defer';
      i += marker.length;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
};

const getEncoder = (): TextEncoder => {
  if (typeof TextEncoder === 'undefined') {
    throw new Error('bQuery SSR: TextEncoder is not available in this runtime.');
  }
  return new TextEncoder();
};

/**
 * Renders a template into a Web `ReadableStream<Uint8Array>` with
 * Suspense-style out-of-order streaming. The synchronous shell is flushed
 * first; deferred slots stream in as their promises resolve.
 *
 * Use `bq-defer="key"` on an element whose content depends on a `defer()`
 * value to mark where the placeholder wrapping should happen. Without the
 * marker, resolved fragments are appended at the end of `<body>`.
 */
export const renderToStreamSuspense = (
  template: string,
  data: BindingContext,
  options: SuspenseStreamOptions = {}
): ReadableStream<Uint8Array> => {
  if (typeof ReadableStream === 'undefined') {
    throw new Error('bQuery SSR: ReadableStream is not available in this runtime.');
  }
  const encoder = getEncoder();
  const ctx: SSRContext = options.context ?? createSSRContext({ ...options, mode: 'stream' });
  const slotIdPrefix = sanitizeSlotPrefix(options.slotIdPrefix ?? 'bq-s', 'bq-s');
  const resolvedIdPrefix = sanitizeSlotPrefix(getResolvedIdPrefix(slotIdPrefix), 'bq-r');

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        try {
          controller.error(new DOMException('SSR stream aborted', 'AbortError'));
        } catch {
          /* already closed */
        }
      };
      if (ctx.signal.aborted) {
        onAbort();
        return;
      }
      ctx.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const { syncContext, slots } = splitDeferred(data, slotIdPrefix);
        const shellTemplate = protectDeferMarkers(template);
        // Render the synchronous shell with fallbacks.
        const shell = renderToString(shellTemplate, syncContext, {
          prefix: options.prefix,
          stripDirectives: options.stripDirectives,
          annotateHydration: options.annotateHydration,
        }).html;

        const wrapped = replaceSlotsInShell(shell, syncContext, slots, options);
        controller.enqueue(encoder.encode(wrapped));

        // Resolve slots in arrival order so the network can flush as soon as
        // each promise settles. Track entries by array position because
        // multiple slots may intentionally share the same promise instance.
        const settledQueue: SettledSuspenseSlot[] = [];
        const waiters: Array<(settled: SettledSuspenseSlot) => void> = [];
        let remaining = slots.length;
        const enqueueSettled = (settled: SettledSuspenseSlot): void => {
          const waiter = waiters.shift();
          if (waiter) {
            waiter(settled);
            return;
          }
          settledQueue.push(settled);
        };

        for (const [index, slot] of slots.entries()) {
          slot.promise.then<SettledSuspenseSlot, SettledSuspenseSlot>(
            (value) => ({ index, slot, ok: true, value }),
            (error) => ({ index, slot, ok: false, error })
          ).then(enqueueSettled);
        }

        const nextSettled = async (): Promise<SettledSuspenseSlot> => {
          const queued = settledQueue.shift();
          if (queued) return queued;
          return new Promise<SettledSuspenseSlot>((resolve) => {
            waiters.push(resolve);
          });
        };

        while (remaining > 0) {
          if (ctx.signal.aborted) {
            return;
          }
          const settled = await nextSettled();
          remaining--;
          const { slot } = settled;
          const resolvedId = `${resolvedIdPrefix}-${slot.id.split('-').pop()}`;
          let resolvedHtml: string;
          if (!settled.ok) {
            ctx.reportError(settled.error);
            resolvedHtml = '';
          } else {
            resolvedHtml = renderResolvedFragment(
              template,
              data,
              syncContext,
              slot.key,
              settled.value,
              options
            );
          }
          const tpl = `<template id="${escapeAttr(resolvedId)}">${resolvedHtml}</template>`;
          const patch = buildPatchScript(slot.id, resolvedId, ctx.nonce);
          controller.enqueue(encoder.encode(tpl + patch));
        }
        controller.close();
      } catch (error) {
        try {
          controller.error(error);
        } catch {
          /* already errored */
        }
      } finally {
        ctx.signal.removeEventListener('abort', onAbort);
      }
    },
  });
};
