import { evaluateRaw } from '../evaluate';
import type { BindingContext } from '../types';

const KEY_ALIASES: Record<string, string[]> = {
  enter: ['Enter'],
  tab: ['Tab'],
  delete: ['Delete', 'Backspace'],
  esc: ['Escape'],
  escape: ['Escape'],
  space: [' ', 'Spacebar'],
  up: ['ArrowUp', 'Up'],
  down: ['ArrowDown', 'Down'],
  left: ['ArrowLeft', 'Left'],
  right: ['ArrowRight', 'Right'],
};

const MOUSE_BUTTONS: Record<string, number> = {
  left: 0,
  middle: 1,
  right: 2,
};

const SYSTEM_MODIFIER_KEYS = new Set(['ctrl', 'alt', 'shift', 'meta']);
const MOUSE_BUTTON_KEYS = new Set(['left', 'middle', 'right']);
const RESERVED_MODIFIERS = new Set([
  'stop',
  'prevent',
  'self',
  'capture',
  'once',
  'passive',
]);

const isReservedKeyword = (mod: string): boolean =>
  RESERVED_MODIFIERS.has(mod) ||
  SYSTEM_MODIFIER_KEYS.has(mod) ||
  MOUSE_BUTTON_KEYS.has(mod);

/**
 * Handles bq-on:event with modifier suffixes such as `.stop`, `.prevent`,
 * `.self`, `.capture`, `.passive`, `.once`, mouse-button filters
 * (`.left`/`.middle`/`.right`), system-modifier requirements
 * (`.ctrl`/`.alt`/`.shift`/`.meta`), and key-name filters (`.enter`, `.esc`,
 * arrow keys, plus arbitrary KeyboardEvent.key values lowercased).
 *
 * @internal
 * @since 1.14.0
 */
export const handleOnWithModifiers = (
  eventName: string,
  modifiers: Set<string>
) => {
  const stop = modifiers.has('stop');
  const prevent = modifiers.has('prevent');
  const self = modifiers.has('self');
  const capture = modifiers.has('capture');
  const passive = modifiers.has('passive');
  const once = modifiers.has('once');

  // Collect key/button filters (everything that isn't a reserved modifier
  // and isn't a system modifier or mouse button) becomes a key filter.
  const keyFilters: string[] = [];
  const requiredSystemKeys: string[] = [];
  let mouseButton: number | null = null;

  for (const mod of modifiers) {
    if (isReservedKeyword(mod)) {
      if (SYSTEM_MODIFIER_KEYS.has(mod)) requiredSystemKeys.push(mod);
      if (MOUSE_BUTTON_KEYS.has(mod)) mouseButton = MOUSE_BUTTONS[mod];
      continue;
    }
    keyFilters.push(mod);
  }

  const matchesKey = (event: KeyboardEvent): boolean => {
    if (keyFilters.length === 0) return true;
    const key = event.key;
    const keyLower = typeof key === 'string' ? key.toLowerCase() : '';
    for (const filter of keyFilters) {
      const aliases = KEY_ALIASES[filter];
      if (aliases) {
        if (aliases.includes(key)) return true;
      } else if (keyLower === filter) {
        return true;
      }
    }
    return false;
  };

  const matchesMouseButton = (event: MouseEvent): boolean => {
    if (mouseButton === null) return true;
    return event.button === mouseButton;
  };

  const matchesSystemKeys = (event: KeyboardEvent | MouseEvent): boolean => {
    for (const required of requiredSystemKeys) {
      const key = required as 'ctrl' | 'alt' | 'shift' | 'meta';
      const prop =
        key === 'ctrl'
          ? 'ctrlKey'
          : key === 'alt'
            ? 'altKey'
            : key === 'shift'
              ? 'shiftKey'
              : 'metaKey';
      if (!(event as unknown as Record<string, boolean>)[prop]) return false;
    }
    return true;
  };

  return (
    el: Element,
    expression: string,
    context: BindingContext,
    cleanups: { push: (fn: () => void) => void }
  ): void => {
    let invoked = false;
    const handler = (event: Event) => {
      if (self && event.target !== el) return;

      // Key/mouse-button filtering applies when the event is the right type.
      if (keyFilters.length > 0 && 'key' in event) {
        if (!matchesKey(event as KeyboardEvent)) return;
      }
      if (mouseButton !== null && 'button' in event) {
        if (!matchesMouseButton(event as MouseEvent)) return;
      }
      if (
        requiredSystemKeys.length > 0 &&
        ('key' in event || 'button' in event)
      ) {
        if (!matchesSystemKeys(event as KeyboardEvent | MouseEvent)) return;
      }

      if (stop) event.stopPropagation();
      if (prevent) event.preventDefault();

      if (once) {
        if (invoked) return;
        invoked = true;
      }

      const eventContext = { ...context, $event: event, $el: el };
      const containsCall = expression.includes('(');
      if (!containsCall) {
        const result = evaluateRaw<unknown>(expression, eventContext);
        if (typeof result === 'function') {
          (result as (e: Event) => void)(event);
        }
        return;
      }
      evaluateRaw(expression, eventContext);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture,
      passive,
      // We manage `once` manually so that the predicate filters (key/button)
      // can short-circuit without consuming the listener slot.
    };
    el.addEventListener(eventName, handler, listenerOptions);
    cleanups.push(() =>
      el.removeEventListener(eventName, handler, listenerOptions)
    );
  };
};
