import { effect } from '../../reactive/index';
import { trustedHtmlForSink } from '../../security/index';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-html directive - sets innerHTML (sanitized by default).
 *
 * The sanitized path routes through `trustedHtmlForSink` so the write produces
 * a Trusted Types value under an enforced `require-trusted-types-for 'script'`
 * CSP. The opt-out (`sanitize: false`) is a deliberate raw-write escape hatch
 * and is left untouched.
 * @internal
 */
export const handleHtml = (sanitize: boolean): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    let previousHtml: string | undefined;
    const cleanup = effect(() => {
      const value = evaluate<string>(expression, context);
      const html = String(value ?? '');
      // Skip the sanitizer and HTML parser when the markup is unchanged.
      if (html === previousHtml) return;
      previousHtml = html;
      el.innerHTML = sanitize ? trustedHtmlForSink(html) : html;
    });
    cleanups.push(cleanup);
  };
};
