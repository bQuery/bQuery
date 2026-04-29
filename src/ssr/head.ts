/**
 * Head manager for SSR.
 *
 * Collects `<title>`, `<meta>`, `<link>` and inline `<script>` directives that
 * a render path wants to inject into the document head, then serialises them
 * as a single HTML string. The same descriptor shape is reused by the
 * server-side head manager methods across SSR entry points.
 *
 * @module bquery/ssr
 */

import { isPrototypePollutionKey } from '../core/utils/object';

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeScriptBody = (value: string): string =>
  value
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/** A `<meta>` tag descriptor. */
export interface SSRMeta {
  name?: string;
  property?: string;
  httpEquiv?: string;
  charset?: string;
  content?: string;
}

/** A `<link>` tag descriptor. */
export interface SSRLink {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  crossorigin?: string;
  media?: string;
  integrity?: string;
  nonce?: string;
}

/** An inline or external `<script>` tag descriptor. */
export interface SSRScript {
  src?: string;
  type?: string;
  body?: string;
  defer?: boolean;
  async?: boolean;
  nonce?: string;
  crossorigin?: string;
  integrity?: string;
  module?: boolean;
}

/** Options accepted by `HeadManager.add()`. */
export interface UseHeadOptions {
  title?: string;
  titleTemplate?: string;
  meta?: SSRMeta[];
  link?: SSRLink[];
  script?: SSRScript[];
}

/** Aggregated head state collected during a render. */
export interface SSRHeadState {
  title: string | null;
  titleTemplate: string | null;
  meta: SSRMeta[];
  link: SSRLink[];
  script: SSRScript[];
}

/** Public head manager handle. */
export interface HeadManager {
  /** Add or replace head entries. */
  add(options: UseHeadOptions): void;
  /** Returns the current state snapshot. */
  state(): SSRHeadState;
  /** Renders the collected head into HTML. */
  render(options?: { nonce?: string }): string;
  /** Resets the manager to an empty state. */
  reset(): void;
}

/**
 * Creates an isolated head manager. Each SSR context owns one instance.
 */
export const createHeadManager = (): HeadManager => {
  const state: SSRHeadState = {
    title: null,
    titleTemplate: null,
    meta: [],
    link: [],
    script: [],
  };

  const add: HeadManager['add'] = (options) => {
    if (typeof options.title === 'string') state.title = options.title;
    if (typeof options.titleTemplate === 'string') state.titleTemplate = options.titleTemplate;
    if (Array.isArray(options.meta)) state.meta.push(...options.meta);
    if (Array.isArray(options.link)) state.link.push(...options.link);
    if (Array.isArray(options.script)) state.script.push(...options.script);
  };

  const render: HeadManager['render'] = (renderOpts = {}) => {
    let html = '';
    if (state.title !== null) {
      const formatted = state.titleTemplate
        ? state.titleTemplate.replace(/%s/g, state.title)
        : state.title;
      html += `<title>${escapeText(formatted)}</title>`;
    }
    for (const m of state.meta) {
      let attrs = '';
      for (const [k, v] of Object.entries(m)) {
        if (v === undefined || v === null) continue;
        if (isPrototypePollutionKey(k)) continue;
        const attrName = k === 'httpEquiv' ? 'http-equiv' : k;
        attrs += ` ${attrName}="${escapeAttr(String(v))}"`;
      }
      html += `<meta${attrs}>`;
    }
    for (const l of state.link) {
      let attrs = ` rel="${escapeAttr(l.rel)}" href="${escapeAttr(l.href)}"`;
      if (l.as) attrs += ` as="${escapeAttr(l.as)}"`;
      if (l.type) attrs += ` type="${escapeAttr(l.type)}"`;
      if (l.crossorigin) attrs += ` crossorigin="${escapeAttr(l.crossorigin)}"`;
      if (l.media) attrs += ` media="${escapeAttr(l.media)}"`;
      if (l.integrity) attrs += ` integrity="${escapeAttr(l.integrity)}"`;
      if (l.nonce ?? renderOpts.nonce) {
        attrs += ` nonce="${escapeAttr(l.nonce ?? renderOpts.nonce!)}"`;
      }
      html += `<link${attrs}>`;
    }
    for (const sc of state.script) {
      let attrs = '';
      if (sc.src) attrs += ` src="${escapeAttr(sc.src)}"`;
      if (sc.type) attrs += ` type="${escapeAttr(sc.type)}"`;
      else if (sc.module) attrs += ' type="module"';
      if (sc.defer) attrs += ' defer';
      if (sc.async) attrs += ' async';
      if (sc.crossorigin) attrs += ` crossorigin="${escapeAttr(sc.crossorigin)}"`;
      if (sc.integrity) attrs += ` integrity="${escapeAttr(sc.integrity)}"`;
      const nonce = sc.nonce ?? renderOpts.nonce;
      if (nonce) attrs += ` nonce="${escapeAttr(nonce)}"`;
      html += `<script${attrs}>${sc.body ? escapeScriptBody(sc.body) : ''}</script>`;
    }
    return html;
  };

  const reset: HeadManager['reset'] = () => {
    state.title = null;
    state.titleTemplate = null;
    state.meta = [];
    state.link = [];
    state.script = [];
  };

  return {
    add,
    state: () =>
      ({
        ...state,
        meta: [...state.meta],
        link: [...state.link],
        script: [...state.script],
      }) as SSRHeadState,
    render,
    reset,
  };
};

/* ---------------------------------------------------------------------------
 * Asset manifest
 * ------------------------------------------------------------------------- */

/** Asset preload entry. */
export interface SSRAsset {
  href: string;
  rel: 'preload' | 'modulepreload' | 'stylesheet';
  as?: string;
  type?: string;
  crossorigin?: string;
  integrity?: string;
}

/** Public asset manager handle. */
export interface AssetManager {
  /** Add a generic preload (`<link rel="preload">`). */
  preload(href: string, opts?: Omit<SSRAsset, 'href' | 'rel'>): void;
  /** Add a JS module preload (`<link rel="modulepreload">`). */
  module(href: string, opts?: Omit<SSRAsset, 'href' | 'rel' | 'as'>): void;
  /** Add a stylesheet link (`<link rel="stylesheet">`). */
  style(href: string, opts?: Omit<SSRAsset, 'href' | 'rel' | 'as'>): void;
  /** Returns the current asset list snapshot. */
  list(): SSRAsset[];
  /** Renders all assets to a series of `<link>` tags. */
  render(options?: { nonce?: string }): string;
  /** Resets the manifest. */
  reset(): void;
}

export const createAssetManager = (): AssetManager => {
  const assets: SSRAsset[] = [];

  return {
    preload(href, opts = {}) {
      assets.push({ href, rel: 'preload', ...opts });
    },
    module(href, opts = {}) {
      assets.push({ href, rel: 'modulepreload', ...opts });
    },
    style(href, opts = {}) {
      assets.push({ href, rel: 'stylesheet', ...opts });
    },
    list: () => [...assets],
    render(renderOpts = {}) {
      let html = '';
      for (const a of assets) {
        let attrs = ` rel="${escapeAttr(a.rel)}" href="${escapeAttr(a.href)}"`;
        if (a.as) attrs += ` as="${escapeAttr(a.as)}"`;
        if (a.type) attrs += ` type="${escapeAttr(a.type)}"`;
        if (a.crossorigin) attrs += ` crossorigin="${escapeAttr(a.crossorigin)}"`;
        if (a.integrity) attrs += ` integrity="${escapeAttr(a.integrity)}"`;
        if (renderOpts.nonce) attrs += ` nonce="${escapeAttr(renderOpts.nonce)}"`;
        html += `<link${attrs}>`;
      }
      return html;
    },
    reset() {
      assets.length = 0;
    },
  };
};
