import { effect } from '../../reactive/index';
import { checkBoundAttribute } from '../../security/bind-guard';
import { sanitizeHtml } from '../../security/sanitize';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-bind:attr directive - attribute binding.
 *
 * The bound value is runtime data, so it is guarded before it reaches the
 * attribute: inline event handlers (`on*`) are never written, URL attributes
 * reject dangerous protocols, and `srcdoc` is sanitized as an HTML sink.
 * @internal
 */
export const handleBind = (attrName: string): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const cleanup = effect(() => {
      const value = evaluate(expression, context);
      if (value == null || value === false) {
        el.removeAttribute(attrName);
        return;
      }
      const stringValue = value === true ? '' : String(value);
      const verdict = checkBoundAttribute(attrName, stringValue);
      if (verdict === 'drop') {
        el.removeAttribute(attrName);
        console.warn(
          `bQuery view: bq-bind:${attrName} dropped an unsafe value (inline handler or dangerous URL)`
        );
        return;
      }
      const finalValue =
        verdict === 'sanitize-html' ? String(sanitizeHtml(stringValue)) : stringValue;
      // Skip the write (and its attribute-mutation side effects) when unchanged.
      if (el.getAttribute(attrName) !== finalValue) {
        el.setAttribute(attrName, finalValue);
      }
    });
    cleanups.push(cleanup);
  };
};
