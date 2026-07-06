/**
 * Security constants and safe lists.
 *
 * @module bquery/security
 */

/**
 * Trusted Types policy name.
 */
export const POLICY_NAME = 'bquery-sanitizer';

/**
 * Default allowed HTML tags considered safe.
 */
export const DEFAULT_ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'br',
  'button',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'optgroup',
  'option',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'section',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
  'wbr',
]);

/**
 * Explicitly dangerous tags that should never be allowed.
 * These are checked even if somehow added to allowTags.
 */
export const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'style',
  'base',
  'template',
  // 'slot' is intentionally excluded here so component shadow markup can opt in
  // via sanitizeHtml(..., { allowTags: ['slot'] }). It remains disallowed by default
  // for general HTML writes, because DEFAULT_ALLOWED_TAGS does not include it.
  'math',
  'svg',
  'foreignobject',
  'noscript',
]);

/**
 * Reserved IDs that could cause DOM clobbering attacks.
 * These are prevented to avoid overwriting global browser objects.
 *
 * This is defense-in-depth, not a complete guarantee: named-property access
 * on `window`/`document`/`HTMLFormElement` can be clobbered by arbitrary
 * `id`/`name` values, so this denylist only blocks the highest-value targets.
 * For fully untrusted content prefer dropping `id`/`name` entirely (or
 * namespacing them). Duplicate-`id` HTMLCollection clobbering is additionally
 * mitigated in `sanitize-core.ts`.
 */
export const RESERVED_IDS = new Set([
  // Global objects
  'document',
  'window',
  'location',
  'top',
  'self',
  'parent',
  'frames',
  'history',
  'navigator',
  'screen',
  'globalthis',
  'defaultview',
  'opener',
  'length',
  'origin',
  'name',
  // Dangerous functions
  'alert',
  'confirm',
  'prompt',
  'eval',
  'function',
  // Document properties / methods
  'cookie',
  'domain',
  'referrer',
  'body',
  'head',
  'title',
  'forms',
  'images',
  'links',
  'scripts',
  'anchors',
  'embeds',
  'plugins',
  'implementation',
  'documentelement',
  'activeelement',
  'getelementbyid',
  'getelementsbyname',
  'getelementsbytagname',
  'getelementsbyclassname',
  'queryselector',
  'queryselectorall',
  'createelement',
  'write',
  'writeln',
  // Node / Element properties
  'attributes',
  'nodename',
  'nodetype',
  'nodevalue',
  'ownerdocument',
  'classlist',
  'dataset',
  'style',
  'id',
  // DOM traversal properties
  'children',
  'childnodes',
  'parentnode',
  'parentelement',
  'firstchild',
  'lastchild',
  'firstelementchild',
  'lastelementchild',
  'nextsibling',
  'previoussibling',
  'nextelementsibling',
  'previouselementsibling',
  // Content manipulation
  'innerhtml',
  'outerhtml',
  'innertext',
  'textcontent',
  'insertadjacenthtml',
]);

/**
 * Default allowed attributes considered safe.
 * Note: 'style' is excluded by default because inline CSS can be abused for:
 * - UI redressing attacks
 * - Data exfiltration via url() in CSS
 * - CSS injection vectors
 * If you need to allow inline styles, add 'style' to allowAttributes in your
 * sanitizeHtml options, but ensure you implement proper CSS value validation.
 */
export const DEFAULT_ALLOWED_ATTRIBUTES = new Set([
  'alt',
  'class',
  'dir',
  'height',
  'hidden',
  'href',
  'id',
  'lang',
  'loading',
  'name',
  'rel',
  'role',
  'src',
  'srcset',
  'tabindex',
  'target',
  'title',
  'type',
  'width',
  'aria-*',
]);

/**
 * Dangerous attribute prefixes to always remove.
 */
export const DANGEROUS_ATTR_PREFIXES = ['on', 'formaction', 'xlink:', 'xmlns:'];

/**
 * Dangerous URL protocols to block.
 */
export const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];
