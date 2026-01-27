import { describe, expect, it } from 'bun:test';
import {
  escapeHtml,
  generateNonce,
  isTrustedTypesSupported,
  sanitizeHtml,
  stripTags,
} from '../src/security/sanitize';

describe('security/sanitizeHtml', () => {
  it('removes script tags', () => {
    const result = sanitizeHtml('<div><script>alert(1)</script>hello</div>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('hello');
  });

  it('removes onclick handlers', () => {
    const result = sanitizeHtml('<button onclick="alert(1)">Click</button>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click');
  });

  it('removes onerror handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('removes onload handlers', () => {
    const result = sanitizeHtml('<body onload="alert(1)">content</body>');
    expect(result).not.toContain('onload');
  });

  it('preserves safe HTML tags', () => {
    const result = sanitizeHtml('<div class="test"><p>Hello</p></div>');
    expect(result).toContain('<div');
    expect(result).toContain('<p>');
    expect(result).toContain('Hello');
  });

  it('preserves safe attributes', () => {
    const result = sanitizeHtml('<a href="/page" class="link" id="test">Link</a>');
    expect(result).toContain('href="/page"');
    expect(result).toContain('class="link"');
    expect(result).toContain('id="test"');
  });

  it('preserves data attributes by default', () => {
    const result = sanitizeHtml('<div data-value="123">Test</div>');
    expect(result).toContain('data-value="123"');
  });

  it('preserves aria attributes', () => {
    const result = sanitizeHtml('<button aria-label="Close">X</button>');
    expect(result).toContain('aria-label="Close"');
  });

  it('removes javascript: URLs from href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('removes data: URLs from src', () => {
    const result = sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain('data:');
  });

  it('allows custom tags via options', () => {
    const result = sanitizeHtml('<custom-tag>Content</custom-tag>', {
      allowTags: ['custom-tag'],
    });
    expect(result).toContain('<custom-tag>');
  });

  it('allows custom attributes via options', () => {
    const result = sanitizeHtml('<div custom-attr="value">Test</div>', {
      allowAttributes: ['custom-attr'],
    });
    expect(result).toContain('custom-attr="value"');
  });

  it('strips all tags when stripAllTags is true', () => {
    const result = sanitizeHtml('<div><b>Bold</b> text</div>', {
      stripAllTags: true,
    });
    expect(result).toBe('Bold text');
  });

  it('disables data attributes when allowDataAttributes is false', () => {
    const result = sanitizeHtml('<div data-secret="123">Test</div>', {
      allowDataAttributes: false,
    });
    expect(result).not.toContain('data-secret');
  });
});

describe('security/escapeHtml', () => {
  it('escapes angle brackets', () => {
    const result = escapeHtml('<script>');
    expect(result).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    const result = escapeHtml('Tom & Jerry');
    expect(result).toBe('Tom &amp; Jerry');
  });

  it('escapes quotes', () => {
    const result = escapeHtml('"Hello" \'World\'');
    expect(result).toBe('&quot;Hello&quot; &#x27;World&#x27;');
  });

  it('escapes backticks', () => {
    const result = escapeHtml('`code`');
    expect(result).toBe('&#x60;code&#x60;');
  });

  it('handles mixed content', () => {
    const result = escapeHtml('<div class="test">Hello & Goodbye</div>');
    expect(result).toBe('&lt;div class=&quot;test&quot;&gt;Hello &amp; Goodbye&lt;/div&gt;');
  });
});

describe('security/stripTags', () => {
  it('removes all HTML tags', () => {
    const result = stripTags('<div><p>Hello</p><span>World</span></div>');
    expect(result).toBe('HelloWorld');
  });

  it('preserves text content', () => {
    const result = stripTags('<b>Bold</b> and <i>italic</i>');
    expect(result).toBe('Bold and italic');
  });

  it('handles nested elements', () => {
    const result = stripTags('<div><div><div>Deep</div></div></div>');
    expect(result).toBe('Deep');
  });
});

describe('security/generateNonce', () => {
  it('generates nonce of default length', () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('generates different nonces each time', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it('respects custom length parameter', () => {
    const short = generateNonce(8);
    const long = generateNonce(32);
    expect(short.length).toBeLessThan(long.length);
  });

  it('generates URL-safe characters', () => {
    const nonce = generateNonce();
    expect(nonce).not.toContain('+');
    expect(nonce).not.toContain('/');
    expect(nonce).not.toContain('=');
  });
});

describe('security/isTrustedTypesSupported', () => {
  it('returns boolean', () => {
    const result = isTrustedTypesSupported();
    expect(typeof result).toBe('boolean');
  });
});

describe('security/enhanced protections', () => {
  it('removes dangerous tags even if explicitly allowed', () => {
    // Try to allow dangerous tags - they should still be blocked
    const result = sanitizeHtml('<script>alert(1)</script>', {
      allowTags: ['script'],
    });
    expect(result).not.toContain('<script>');
  });

  it('blocks iframe tags', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('blocks object/embed tags', () => {
    const result = sanitizeHtml('<object data="x"></object><embed src="y">');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('blocks template tags', () => {
    const result = sanitizeHtml('<template><script>alert(1)</script></template>');
    expect(result).not.toContain('<template');
  });

  it('blocks svg tags', () => {
    const result = sanitizeHtml('<svg onload="alert(1)"></svg>');
    expect(result).not.toContain('<svg');
  });

  it('removes xlink: attributes', () => {
    const result = sanitizeHtml('<a xlink:href="javascript:alert(1)">Link</a>');
    expect(result).not.toContain('xlink:');
  });

  it('removes file: protocol URLs', () => {
    const result = sanitizeHtml('<a href="file:///etc/passwd">File</a>');
    expect(result).not.toContain('file:');
  });

  it('prevents DOM clobbering via reserved IDs', () => {
    const result = sanitizeHtml('<div id="document">Test</div>');
    expect(result).not.toContain('id="document"');
  });

  it('prevents DOM clobbering via reserved names', () => {
    const result = sanitizeHtml('<input name="location">');
    expect(result).not.toContain('name="location"');
  });

  it('handles Unicode bypass attempts', () => {
    // Zero-width characters shouldn't bypass protocol check
    const result = sanitizeHtml('<a href="java\u200Bscript:alert(1)">Link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('adds rel="noopener noreferrer" to links with target="_blank"', () => {
    const result = sanitizeHtml('<a href="/page" target="_blank">Link</a>');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('adds rel="noopener noreferrer" to external links', () => {
    const result = sanitizeHtml('<a href="https://external.com">Link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('preserves existing rel values when adding security attributes', () => {
    const result = sanitizeHtml('<a href="https://external.com" rel="author">Link</a>');
    expect(result).toContain('noopener');
    expect(result).toContain('noreferrer');
    expect(result).toContain('author');
  });

  it('does not add rel to internal links without target="_blank"', () => {
    const result = sanitizeHtml('<a href="/internal">Link</a>');
    expect(result).not.toContain('rel=');
  });

  it('handles links with target="_blank" and existing rel', () => {
    const result = sanitizeHtml('<a href="/page" target="_blank" rel="prev">Link</a>');
    expect(result).toContain('noopener');
    expect(result).toContain('noreferrer');
    expect(result).toContain('prev');
  });

  it('treats protocol-relative URLs as external', () => {
    const result = sanitizeHtml('<a href="//external.com/page">Link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('handles hash and query string URLs as internal', () => {
    const result = sanitizeHtml('<a href="#section">Link</a>');
    expect(result).not.toContain('rel=');

    const result2 = sanitizeHtml('<a href="?query=value">Link</a>');
    expect(result2).not.toContain('rel=');
  });

  it('treats mailto and tel links as external for security', () => {
    const mailto = sanitizeHtml('<a href="mailto:test@example.com">Email</a>');
    expect(mailto).toContain('rel="noopener noreferrer"');

    const tel = sanitizeHtml('<a href="tel:+1234567890">Call</a>');
    expect(tel).toContain('rel="noopener noreferrer"');
  });

  it('handles rel attribute with leading/trailing whitespace', () => {
    const result = sanitizeHtml('<a href="https://external.com" rel="  author  ">Link</a>');
    expect(result).toContain('noopener');
    expect(result).toContain('noreferrer');
    expect(result).toContain('author');
  });

  it('handles URLs with uppercase protocols', () => {
    const result1 = sanitizeHtml('<a href="HTTP://external.com">Link</a>');
    expect(result1).toContain('rel="noopener noreferrer"');

    const result2 = sanitizeHtml('<a href="HTTPS://external.com">Link</a>');
    expect(result2).toContain('rel="noopener noreferrer"');

    const result3 = sanitizeHtml('<a href="MAILTO:test@example.com">Email</a>');
    expect(result3).toContain('rel="noopener noreferrer"');
  });

  it('handles URLs with leading/trailing whitespace', () => {
    const result = sanitizeHtml('<a href="  https://external.com  ">Link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('handles case-insensitive target="_blank"', () => {
    const result1 = sanitizeHtml('<a href="/page" target="_BLANK">Link</a>');
    expect(result1).toContain('rel="noopener noreferrer"');

    const result2 = sanitizeHtml('<a href="/page" target="_Blank">Link</a>');
    expect(result2).toContain('rel="noopener noreferrer"');

    const result3 = sanitizeHtml('<a href="/page" target="_blank">Link</a>');
    expect(result3).toContain('rel="noopener noreferrer"');
  });

  it('treats absolute URLs as external in SSR/Node.js environments', () => {
    // Save the original window object
    const originalWindow = globalThis.window;

    try {
      // Simulate SSR environment by temporarily removing window
      // @ts-expect-error - Intentionally setting to undefined for testing
      globalThis.window = undefined;

      const result = sanitizeHtml('<a href="https://external.com">Link</a>');
      expect(result).toContain('rel="noopener noreferrer"');
    } finally {
      // Restore the original window object
      globalThis.window = originalWindow;
    }
  });
});
