import type { CleanupFn } from '../reactive/index';
import {
  createForHandler,
  handleBind,
  handleClass,
  handleHtml,
  handleIf,
  handleModel,
  handleOn,
  handleRef,
  handleShow,
  handleStyle,
  handleText,
} from './directives/index';
import { processChildren, processElement, type DirectiveHandlers } from './process';
import type { BindingContext, MountOptions, View } from './types';

/**
 * Mounts a reactive view to an element.
 *
 * @param selector - CSS selector or Element
 * @param context - Binding context with signals, computed, and functions
 * @param options - Mount options
 * @returns The mounted View instance
 *
 * @security **WARNING:** Directive expressions (bq-text, bq-if, bq-on, etc.) are evaluated
 * using `new Function()` at runtime. This means:
 * - Template attributes must come from trusted sources only
 * - NEVER load templates containing bq-* attributes from user input or untrusted APIs
 * - If you must use external templates, validate/sanitize attribute values first
 *
 * @example
 * ```ts
 * import { mount } from 'bquery/view';
 * import { signal, computed } from 'bquery/reactive';
 *
 * const name = signal('World');
 * const greeting = computed(() => `Hello, ${name.value}!`);
 * const items = signal([
 *   { id: 1, text: 'Item 1' },
 *   { id: 2, text: 'Item 2' },
 * ]);
 *
 * const view = mount('#app', {
 *   name,
 *   greeting,
 *   items,
 *   addItem: () => {
 *     items.value = [...items.value, { id: Date.now(), text: 'New Item' }];
 *   },
 * });
 *
 * // Later, cleanup
 * view.destroy();
 * ```
 */
export const mount = (
  selector: string | Element,
  context: BindingContext,
  options: MountOptions = {}
): View => {
  const { prefix = 'bq', sanitize = true } = options;

  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;

  if (!el) {
    throw new Error(`bQuery view: Element "${selector}" not found.`);
  }

  const cleanups: CleanupFn[] = [];

  const handlers: DirectiveHandlers = {
    text: handleText,
    html: handleHtml(sanitize),
    if: handleIf,
    show: handleShow,
    class: handleClass,
    style: handleStyle,
    model: handleModel,
    ref: handleRef,
    for: createForHandler({
      prefix,
      processElement: (node, nodeContext, nodePrefix, nodeCleanups) =>
        processElement(node, nodeContext, nodePrefix, nodeCleanups, handlers),
      processChildren: (node, nodeContext, nodePrefix, nodeCleanups) =>
        processChildren(node, nodeContext, nodePrefix, nodeCleanups, handlers),
    }),
    bind: handleBind,
    on: handleOn,
  };

  const processWithHandlers = (
    node: Element,
    nodeContext: BindingContext,
    nodeCleanups: CleanupFn[]
  ) => {
    // Check if element has bq-for before processing
    // bq-for replaces the element and handles its children internally
    const hasFor = node.hasAttribute(`${prefix}-for`);
    
    processElement(node, nodeContext, prefix, nodeCleanups, handlers);
    
    // Skip processChildren if bq-for was on this element - it handles children itself
    if (!hasFor) {
      processChildren(node, nodeContext, prefix, nodeCleanups, handlers);
    }
  };

  // Process the root element and its children
  processWithHandlers(el, context, cleanups);

  return {
    el,
    context,

    update: (newContext: Partial<BindingContext>) => {
      Object.assign(context, newContext);
    },

    destroy: () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;
    },
  };
};

/**
 * Creates a reactive template function.
 *
 * @param template - HTML template string
 * @returns A function that creates a mounted element with the given context
 *
 * @example
 * ```ts
 * import { createTemplate } from 'bquery/view';
 * import { signal } from 'bquery/reactive';
 *
 * const TodoItem = createTemplate(`
 *   <li bq-class="{ completed: done }">
 *     <input type="checkbox" bq-model="done" />
 *     <span bq-text="text"></span>
 *   </li>
 * `);
 *
 * const item = TodoItem({
 *   done: signal(false),
 *   text: 'Buy groceries',
 * });
 *
 * document.querySelector('#list').append(item.el);
 * ```
 */
export const createTemplate = (
  template: string,
  options: MountOptions = {}
): ((context: BindingContext) => View) => {
  return (context: BindingContext) => {
    const container = document.createElement('div');
    container.innerHTML = template.trim();

    const el = container.firstElementChild;
    if (!el) {
      throw new Error('bQuery view: Template must contain a single root element.');
    }
    
    // We know at least one element exists (firstElementChild is not null above)
    // Reject if there are multiple root elements
    if (container.childElementCount > 1) {
      throw new Error(
        `bQuery view: Template must contain exactly one root element, found ${container.childElementCount}.`
      );
    }

    const prefix = options.prefix || 'bq';
    // Reject templates with bq-for on the root element
    // bq-for replaces the element with a placeholder comment, which would leave View.el detached
    if (el.hasAttribute(`${prefix}-for`)) {
      throw new Error(
        `bQuery view: Template root element cannot have ${prefix}-for directive. ` +
          `Wrap the ${prefix}-for element in a container instead.`
      );
    }

    return mount(el, context, options);
  };
};
