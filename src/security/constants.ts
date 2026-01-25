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
  'slot',
  'math',
  'svg',
  'foreignobject',
  'noscript',
]);

/**
 * Reserved IDs that could cause DOM clobbering attacks.
 * These are prevented to avoid overwriting global browser objects.
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
  // Dangerous functions
  'alert',
  'confirm',
  'prompt',
  'eval',
  'Function',
  // Document properties
  'cookie',
  'domain',
  'referrer',
  'body',
  'head',
  'forms',
  'images',
  'links',
  'scripts',
  // DOM traversal properties
  'children',
  'parentNode',
  'firstChild',
  'lastChild',
  // Content manipulation
  'innerHTML',
  'outerHTML',
  'textContent',
]);

/**
 * Default allowed attributes considered safe.
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
  'style',
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
