/**
 * CSP nonce injection for the Vite dev server.
 *
 * A nonce from bQuery's `generateNonce()` is created once per dev-server start
 * and handed to Vite's built-in `html.cspNonce` support, which stamps it on
 * every `<script>`, `<style>` and stylesheet/preload `<link>` in served HTML
 * (including SSR output passed through `transformIndexHtml`) and adds the
 * `<meta property="csp-nonce">` tag Vite's client reads for injected styles.
 * A middleware sends the matching `Content-Security-Policy` header.
 *
 * @module @bquery/unplugin/csp
 */

import { generateNonce } from '@bquery/bquery/security';

/** Default directives; `script-src` / `style-src` always receive the nonce. */
export const DEFAULT_CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'ws:', 'wss:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
};

/**
 * Builds a policy string from defaults, user overrides and the nonce.
 *
 * @param {string} nonce - The active nonce.
 * @param {Record<string, string | string[] | false>} [overrides] - Directive
 *   overrides; `false` removes a directive.
 * @returns {string} The `Content-Security-Policy` header value.
 */
export const buildCspPolicy = (nonce, overrides = {}) => {
  const directives = { ...DEFAULT_CSP_DIRECTIVES };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === false) delete directives[name];
    else directives[name] = Array.isArray(value) ? value : String(value).split(/\s+/);
  }
  const token = `'nonce-${nonce}'`;
  for (const name of ['script-src', 'style-src']) {
    if (directives[name] && !directives[name].includes(token)) {
      directives[name] = [...directives[name], token];
    }
  }
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' ').trim())
    .join('; ');
};

/**
 * Whether a request is for an HTML document (navigation).
 *
 * @param {{ headers?: Record<string, string | string[] | undefined> }} req - Node request.
 * @returns {boolean} Whether the request accepts HTML.
 */
export const acceptsHtml = (req) => {
  const accept = req.headers?.accept;
  return typeof accept === 'string' && accept.includes('text/html');
};

/**
 * Creates the `bquery:csp` plugin (Vite only).
 *
 * @param {object} options - CSP options (see `CspOptions` in `index.d.ts`).
 * @param {{ getNonce?: () => string | undefined }} shared - Shared state; the
 *   active nonce is published here for the SSR middleware.
 * @returns {import('unplugin').UnpluginOptions} The plugin.
 */
export const createCspPlugin = (options, shared) => {
  let nonce;
  let enabled = false;
  const fixed = typeof options.nonce === 'string' && options.nonce !== 'auto';

  shared.getNonce = () => (enabled ? nonce : undefined);

  return {
    name: 'bquery:csp',
    vite: {
      config(userConfig, env) {
        const serve = env.command === 'serve';
        if (!serve && !options.build) return undefined;
        if (!serve && !fixed) {
          console.warn(
            '[bquery:csp] `csp.build` needs a fixed `nonce` string (e.g. a placeholder your ' +
              'server replaces per request); skipping nonce injection for this build.'
          );
          return undefined;
        }
        enabled = true;
        nonce = userConfig.html?.cspNonce ?? (fixed ? options.nonce : generateNonce());
        return { html: { cspNonce: nonce } };
      },
      configureServer(server) {
        if (!enabled || options.header === false) return;
        const headerName = options.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';
        const policy =
          typeof options.policy === 'function'
            ? options.policy(nonce)
            : typeof options.policy === 'string'
              ? options.policy.replace(/\{nonce\}/g, nonce)
              : buildCspPolicy(nonce, options.directives);
        server.middlewares.use((req, res, next) => {
          if (acceptsHtml(req) && !res.headersSent) res.setHeader(headerName, policy);
          next();
        });
      },
    },
  };
};
