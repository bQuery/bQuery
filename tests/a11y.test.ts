/**
 * Tests for the bQuery a11y (accessibility) module.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  announceToScreenReader,
  auditA11y,
  clearAnnouncements,
  getFocusableElements,
  prefersColorScheme,
  prefersContrast,
  prefersReducedMotion,
  releaseFocus,
  rovingTabIndex,
  skipLink,
  trapFocus,
} from '../src/a11y/index';

// ─── Test Helpers ────────────────────────────────────────────────────────────

const createContainer = (html: string): HTMLElement => {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
};

const fireKeydown = (
  target: EventTarget,
  key: string,
  opts: Partial<KeyboardEventInit> = {}
): void => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  target.dispatchEvent(event);
};

// ─── trapFocus ───────────────────────────────────────────────────────────────

describe('a11y/trapFocus', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer(`
      <button id="btn1">Button 1</button>
      <input id="input1" type="text" />
      <a href="#" id="link1">Link 1</a>
      <button id="btn2">Button 2</button>
    `);
  });

  afterEach(() => {
    container.remove();
  });

  it('should focus the first focusable element on activation', () => {
    const trap = trapFocus(container);
    expect(document.activeElement).toBe(container.querySelector('#btn1'));
    trap.release();
  });

  it('should focus initialFocus element when provided', () => {
    const trap = trapFocus(container, { initialFocus: '#input1' });
    expect(document.activeElement).toBe(container.querySelector('#input1'));
    trap.release();
  });

  it('should report active state correctly', () => {
    const trap = trapFocus(container);
    expect(trap.active).toBe(true);
    trap.release();
    expect(trap.active).toBe(false);
  });

  it('should release focus on Escape key', () => {
    const btn = document.createElement('button');
    btn.id = 'outside';
    document.body.appendChild(btn);
    btn.focus();

    const trap = trapFocus(container, { escapeDeactivates: true });
    fireKeydown(document, 'Escape');
    expect(trap.active).toBe(false);
    btn.remove();
  });

  it('should call onEscape callback', () => {
    let escaped = false;
    const trap = trapFocus(container, {
      escapeDeactivates: true,
      onEscape: () => {
        escaped = true;
      },
    });
    fireKeydown(document, 'Escape');
    expect(escaped).toBe(true);
    trap.release();
  });

  it('should not release on Escape when escapeDeactivates is false', () => {
    const trap = trapFocus(container, { escapeDeactivates: false });
    fireKeydown(document, 'Escape');
    expect(trap.active).toBe(true);
    trap.release();
  });

  it('should wrap focus on Tab at last element', () => {
    const trap = trapFocus(container);
    const btn2 = container.querySelector('#btn2') as HTMLElement;
    btn2.focus();

    fireKeydown(document, 'Tab');
    // The trap prevents default and refocuses first element
    expect(document.activeElement).toBe(container.querySelector('#btn1'));
    trap.release();
  });

  it('should wrap focus on Shift+Tab at first element', () => {
    const trap = trapFocus(container);
    const btn1 = container.querySelector('#btn1') as HTMLElement;
    btn1.focus();

    fireKeydown(document, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(container.querySelector('#btn2'));
    trap.release();
  });

  it('should handle container with no focusable elements', () => {
    const emptyContainer = createContainer('<div>No focusable elements</div>');
    const trap = trapFocus(emptyContainer);
    // Should not throw
    fireKeydown(document, 'Tab');
    expect(trap.active).toBe(true);
    trap.release();
    emptyContainer.remove();
  });

  it('should not do anything after release', () => {
    const trap = trapFocus(container);
    trap.release();
    // Double release should not throw
    trap.release();
    expect(trap.active).toBe(false);
  });

  it('should return a no-op handle when document APIs are unavailable', () => {
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        configurable: true,
      });

      const trap = trapFocus(container);
      expect(trap.active).toBe(false);
      expect(() => trap.release()).not.toThrow();
    } finally {
      if (originalDocumentDescriptor) {
        Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      }
    }
  });

  it('should return focus to returnFocus element on release', () => {
    const returnBtn = document.createElement('button');
    returnBtn.id = 'return-target';
    document.body.appendChild(returnBtn);

    const trap = trapFocus(container, { returnFocus: '#return-target' });
    trap.release();
    expect(document.activeElement).toBe(returnBtn);
    returnBtn.remove();
  });
});

describe('a11y/getFocusableElements', () => {
  it('should find all focusable elements', () => {
    const container = createContainer(`
      <button>Btn</button>
      <input type="text" />
      <a href="#">Link</a>
      <select><option>Opt</option></select>
      <textarea></textarea>
      <div tabindex="0">Tabbed div</div>
      <div tabindex="-1">Not tabbable</div>
      <button disabled>Disabled</button>
    `);

    const focusable = getFocusableElements(container);
    // Should include: button, input, a, select, textarea, div[tabindex=0]
    // Should exclude: div[tabindex=-1], disabled button
    expect(focusable.length).toBeGreaterThanOrEqual(5);
    container.remove();
  });

  it('should return empty array for container with no focusable elements', () => {
    const container = createContainer('<div><p>Just text</p></div>');
    const focusable = getFocusableElements(container);
    expect(focusable).toEqual([]);
    container.remove();
  });

  it('should include visible fixed-position elements', () => {
    const container = createContainer('<button id="fixed">Fixed</button>');
    const fixed = container.querySelector('#fixed') as HTMLElement;
    fixed.style.position = 'fixed';

    const focusable = getFocusableElements(container);
    expect(focusable).toContain(fixed);

    container.remove();
  });
});

describe('a11y/releaseFocus', () => {
  it('should release a trap handle', () => {
    const container = createContainer('<button>Btn</button>');
    const trap = trapFocus(container);
    expect(trap.active).toBe(true);
    releaseFocus(trap);
    expect(trap.active).toBe(false);
    container.remove();
  });
});

// ─── announceToScreenReader ──────────────────────────────────────────────────

describe('a11y/announceToScreenReader', () => {
  afterEach(() => {
    clearAnnouncements();
  });

  it('should create a polite live region', async () => {
    announceToScreenReader('Hello');

    // Wait for the setTimeout
    await new Promise((resolve) => setTimeout(resolve, 100));

    const region = document.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('Hello');
  });

  it('should create an assertive live region', async () => {
    announceToScreenReader('Alert!', 'assertive');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const region = document.querySelector('[aria-live="assertive"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('Alert!');
  });

  it('should not create a region for empty messages', () => {
    announceToScreenReader('');
    const regions = document.querySelectorAll('[aria-live]');
    // No new region should be created for empty messages
    expect(regions.length).toBe(0);
  });

  it('should no-op when document.body is unavailable', () => {
    const originalBody = document.body;
    Object.defineProperty(document, 'body', {
      configurable: true,
      value: null,
    });

    try {
      announceToScreenReader('Hello');
      expect(document.querySelectorAll('[aria-live]').length).toBe(0);
    } finally {
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
    }
  });

  it('should update existing region for same priority', async () => {
    announceToScreenReader('First');
    await new Promise((resolve) => setTimeout(resolve, 100));

    announceToScreenReader('Second');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const regions = document.querySelectorAll('[aria-live="polite"]');
    expect(regions.length).toBe(1);
    expect(regions[0].textContent).toBe('Second');
  });

  it('should have correct ARIA attributes for assertive region', async () => {
    announceToScreenReader('Alert!', 'assertive');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const region = document.querySelector('[aria-live="assertive"]');
    expect(region?.getAttribute('role')).toBe('alert');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it('should have correct ARIA attributes for polite region', async () => {
    announceToScreenReader('Info');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const region = document.querySelector('[aria-live="polite"]');
    expect(region?.getAttribute('role')).toBe('status');
  });
});

describe('a11y/clearAnnouncements', () => {
  it('should remove all live regions', async () => {
    announceToScreenReader('Test 1');
    announceToScreenReader('Test 2', 'assertive');
    await new Promise((resolve) => setTimeout(resolve, 100));

    clearAnnouncements();

    const regions = document.querySelectorAll('[aria-live]');
    expect(regions.length).toBe(0);
  });

  it('should cancel pending announcements before they update detached regions', async () => {
    announceToScreenReader('Pending');
    clearAnnouncements();

    await new Promise((resolve) => setTimeout(resolve, 100));

    const regions = document.querySelectorAll('[aria-live]');
    expect(regions.length).toBe(0);
  });
});

// ─── rovingTabIndex ──────────────────────────────────────────────────────────

describe('a11y/rovingTabIndex', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer(`
      <div role="toolbar" id="toolbar">
        <button>A</button>
        <button>B</button>
        <button>C</button>
      </div>
    `);
  });

  afterEach(() => {
    container.remove();
  });

  it('should initialize tabindex on items', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');

    const buttons = toolbar.querySelectorAll('button');
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    expect(buttons[1].getAttribute('tabindex')).toBe('-1');
    expect(buttons[2].getAttribute('tabindex')).toBe('-1');

    handle.destroy();
  });

  it('should navigate with ArrowDown (vertical orientation)', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { orientation: 'vertical' });

    const buttons = toolbar.querySelectorAll('button');
    buttons[0].focus();

    fireKeydown(toolbar, 'ArrowDown');
    expect(handle.activeIndex()).toBe(1);
    expect(buttons[1].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');

    handle.destroy();
  });

  it('should navigate with ArrowRight (horizontal orientation)', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { orientation: 'horizontal' });

    const buttons = toolbar.querySelectorAll('button');
    buttons[0].focus();

    fireKeydown(toolbar, 'ArrowRight');
    expect(handle.activeIndex()).toBe(1);

    handle.destroy();
  });

  it('should navigate with ArrowLeft/ArrowUp backwards', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { orientation: 'both' });

    handle.focusItem(2);
    fireKeydown(toolbar, 'ArrowLeft');
    expect(handle.activeIndex()).toBe(1);

    fireKeydown(toolbar, 'ArrowUp');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
  });

  it('should wrap around when wrap is true', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { wrap: true });

    handle.focusItem(2);
    fireKeydown(toolbar, 'ArrowDown');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
  });

  it('should not wrap when wrap is false', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { wrap: false });

    handle.focusItem(2);
    fireKeydown(toolbar, 'ArrowDown');
    expect(handle.activeIndex()).toBe(2); // Stays at last

    handle.destroy();
  });

  it('should jump to first on Home', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');

    handle.focusItem(2);
    fireKeydown(toolbar, 'Home');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
  });

  it('should jump to last on End', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');

    fireKeydown(toolbar, 'End');
    expect(handle.activeIndex()).toBe(2);

    handle.destroy();
  });

  it('should call onActivate callback', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    let activatedIndex = -1;

    const handle = rovingTabIndex(toolbar, 'button', {
      onActivate: (_, index) => {
        activatedIndex = index;
      },
    });

    fireKeydown(toolbar, 'ArrowDown');
    expect(activatedIndex).toBe(1);

    handle.destroy();
  });

  it('should focus item programmatically', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');

    handle.focusItem(2);
    expect(handle.activeIndex()).toBe(2);

    const buttons = toolbar.querySelectorAll('button');
    expect(buttons[2].getAttribute('tabindex')).toBe('0');

    handle.destroy();
  });

  it('should clean up on destroy', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');
    handle.destroy();

    const buttons = toolbar.querySelectorAll('button');
    // All tabindex attributes should be removed
    for (const btn of buttons) {
      expect(btn.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('should restore pre-existing tabindex values on destroy', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const buttons = toolbar.querySelectorAll('button');
    buttons[0].setAttribute('tabindex', '5');
    buttons[2].setAttribute('tabindex', '2');

    const handle = rovingTabIndex(toolbar, 'button');
    handle.destroy();

    expect(buttons[0].getAttribute('tabindex')).toBe('5');
    expect(buttons[1].hasAttribute('tabindex')).toBe(false);
    expect(buttons[2].getAttribute('tabindex')).toBe('2');
  });

  it('should handle empty container gracefully', () => {
    const emptyContainer = createContainer('<div id="empty"></div>');
    const toolbar = emptyContainer.querySelector('#empty') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');

    // Should not throw
    fireKeydown(toolbar, 'ArrowDown');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
    emptyContainer.remove();
  });

  it('should ignore non-relevant keys for horizontal orientation', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { orientation: 'horizontal' });

    // ArrowDown should be ignored for horizontal
    fireKeydown(toolbar, 'ArrowDown');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
  });

  it('should ignore non-relevant keys for vertical orientation', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button', { orientation: 'vertical' });

    // ArrowRight should be ignored for vertical
    fireKeydown(toolbar, 'ArrowRight');
    expect(handle.activeIndex()).toBe(0);

    handle.destroy();
  });

  it('should not modify late-added items that were never tracked when destroyed', () => {
    const toolbar = container.querySelector('#toolbar') as HTMLElement;
    const handle = rovingTabIndex(toolbar, 'button');
    const lateButton = document.createElement('button');
    lateButton.textContent = 'Late';
    lateButton.setAttribute('tabindex', '5');
    toolbar.appendChild(lateButton);

    handle.destroy();

    expect(lateButton.getAttribute('tabindex')).toBe('5');
  });
});

// ─── skipLink ────────────────────────────────────────────────────────────────

describe('a11y/skipLink', () => {
  const getSkipLinkElement = (handle: ReturnType<typeof skipLink>): HTMLAnchorElement => {
    if (!handle.element) {
      throw new Error('Expected skipLink() to return an anchor element in a DOM environment.');
    }

    return handle.element;
  };

  afterEach(() => {
    // Clean up any remaining skip links
    document.querySelectorAll('.bq-skip-link').forEach((el) => el.remove());
  });

  it('should create a skip link element', () => {
    const handle = skipLink('#main');
    const element = getSkipLinkElement(handle);
    expect(element).toBeInstanceOf(HTMLAnchorElement);
    expect(element.textContent).toBe('Skip to main content');
    expect(element.href).toContain('#main');
    handle.destroy();
  });

  it('should insert as first child of body', () => {
    const handle = skipLink('#main');
    expect(document.body.firstChild).toBe(getSkipLinkElement(handle));
    handle.destroy();
  });

  it('should use custom text', () => {
    const handle = skipLink('#content', { text: 'Jump to content' });
    expect(getSkipLinkElement(handle).textContent).toBe('Jump to content');
    handle.destroy();
  });

  it('should use custom className', () => {
    const handle = skipLink('#main', { className: 'my-skip' });
    expect(getSkipLinkElement(handle).className).toBe('my-skip');
    handle.destroy();
  });

  it('should remove on destroy', () => {
    const handle = skipLink('#main');
    const el = getSkipLinkElement(handle);
    expect(el.isConnected).toBe(true);
    handle.destroy();
    expect(el.isConnected).toBe(false);
  });

  it('should focus target on click', () => {
    const target = document.createElement('div');
    target.id = 'main-content';
    document.body.appendChild(target);

    const handle = skipLink('#main-content');
    getSkipLinkElement(handle).click();

    // Target should have been made focusable
    expect(target.getAttribute('tabindex')).toBe('-1');
    handle.destroy();
    target.remove();
  });

  it('should not add tabindex to naturally focusable targets', () => {
    const target = document.createElement('button');
    target.id = 'main-button';
    document.body.appendChild(target);

    const handle = skipLink('#main-button');
    getSkipLinkElement(handle).click();

    expect(document.activeElement).toBe(target);
    expect(target.hasAttribute('tabindex')).toBe(false);

    handle.destroy();
    target.remove();
  });

  it('should prepend # when targetSelector lacks it', () => {
    const target = document.createElement('div');
    target.id = 'main-section';
    document.body.appendChild(target);

    const handle = skipLink('main-section');
    const element = getSkipLinkElement(handle);
    expect(element.href).toContain('#main-section');
    element.click();
    expect(target.getAttribute('tabindex')).toBe('-1');
    handle.destroy();
    target.remove();
  });

  it('should resolve hash targets whose ids are not valid CSS identifier starts', () => {
    const target = document.createElement('div');
    target.id = '123main';
    document.body.appendChild(target);

    const handle = skipLink('#123main');
    getSkipLinkElement(handle).click();

    expect(document.activeElement).toBe(target);

    handle.destroy();
    target.remove();
  });

  it('should support general selectors without forcing them into ids', () => {
    const main = document.createElement('main');
    const section = document.createElement('section');
    document.body.append(main, section);

    const mainHandle = skipLink('main');
    const sectionHandle = skipLink('section');
    const mainElement = getSkipLinkElement(mainHandle);
    const sectionElement = getSkipLinkElement(sectionHandle);

    expect(mainElement.href).toMatch(/#bq-skip-target-\d+$/);
    expect(sectionElement.href).toMatch(/#bq-skip-target-\d+$/);
    expect(mainElement.href).not.toBe(sectionElement.href);

    mainElement.click();
    expect(document.activeElement).toBe(main);
    sectionElement.click();
    expect(document.activeElement).toBe(section);

    mainHandle.destroy();
    sectionHandle.destroy();
    main.remove();
    section.remove();
  });

  it('should only remove an auto-generated id from the original tracked target', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);

    const handle = skipLink('main');
    const generatedId = getSkipLinkElement(handle).href.split('#')[1]!;

    main.removeAttribute('id');

    const replacement = document.createElement('div');
    replacement.id = generatedId;
    document.body.appendChild(replacement);

    handle.destroy();

    expect(replacement.id).toBe(generatedId);

    main.remove();
    replacement.remove();
  });

  it('should skip pre-existing generated ids when assigning a target id', () => {
    const collision = document.createElement('div');
    collision.id = 'bq-skip-target-1';
    document.body.appendChild(collision);

    const main = document.createElement('main');
    document.body.appendChild(main);

    const handle = skipLink('main');
    const generatedId = getSkipLinkElement(handle).href.split('#')[1]!;

    expect(generatedId).not.toBe('bq-skip-target-1');
    expect(main.id).toBe(generatedId);

    handle.destroy();
    main.remove();
    collision.remove();
  });

  it('should return a no-op handle when document APIs are unavailable', () => {
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        configurable: true,
      });

      const handle = skipLink('#main');
      expect(handle.element).toBeNull();
      expect(handle).toEqual({
        destroy: expect.any(Function),
        element: null,
      });
      expect(() => handle.destroy()).not.toThrow();
    } finally {
      if (originalDocumentDescriptor) {
        Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      }
    }
  });

  it('should prevent default anchor navigation when no target can be resolved', () => {
    const handle = skipLink('#missing-main');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

    expect(getSkipLinkElement(handle).dispatchEvent(clickEvent)).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(true);

    handle.destroy();
  });

  it('should ignore invalid selector syntax when resolving a target', () => {
    const handle = skipLink('123main>>');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

    expect(() => getSkipLinkElement(handle).dispatchEvent(clickEvent)).not.toThrow();
    expect(clickEvent.defaultPrevented).toBe(true);

    handle.destroy();
  });
});

// ─── prefersReducedMotion ────────────────────────────────────────────────────

describe('a11y/prefersReducedMotion', () => {
  it('should return a signal with a boolean value', () => {
    const sig = prefersReducedMotion();
    expect(typeof sig.value).toBe('boolean');
    sig.destroy();
  });

  it('should have a peek method', () => {
    const sig = prefersReducedMotion();
    expect(typeof sig.peek()).toBe('boolean');
    sig.destroy();
  });

  it('should remove its media-query listener on destroy', () => {
    let registeredHandler: ((event: MediaQueryListEvent) => void) | undefined;
    let removedHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = (() =>
      ({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandler = handler;
        },
        removeEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          removedHandler = handler;
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersReducedMotion();
      sig.destroy();
      expect(removedHandler).toBe(registeredHandler);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('should fall back to legacy media-query listeners when needed', () => {
    let registeredHandler: ((event: MediaQueryListEvent | MediaQueryList) => void) | undefined;
    let removedHandler: ((event: MediaQueryListEvent | MediaQueryList) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = (() =>
      ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: undefined,
        removeEventListener: undefined,
        addListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          registeredHandler = handler;
        },
        removeListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          removedHandler = handler;
        },
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersReducedMotion();

      expect(sig.value).toBe(true);

      sig.destroy();
      expect(removedHandler).toBe(registeredHandler);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

// ─── prefersColorScheme ──────────────────────────────────────────────────────

describe('a11y/prefersColorScheme', () => {
  it('should return a signal with light or dark', () => {
    const sig = prefersColorScheme();
    expect(['light', 'dark']).toContain(sig.value);
    sig.destroy();
  });

  it('should have a peek method', () => {
    const sig = prefersColorScheme();
    expect(['light', 'dark']).toContain(sig.peek());
    sig.destroy();
  });

  it('should remove its media-query listener on destroy', () => {
    let registeredHandler: ((event: MediaQueryListEvent) => void) | undefined;
    let removedHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = (() =>
      ({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandler = handler;
        },
        removeEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          removedHandler = handler;
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersColorScheme();
      sig.destroy();
      expect(removedHandler).toBe(registeredHandler);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

// ─── prefersContrast ─────────────────────────────────────────────────────────

describe('a11y/prefersContrast', () => {
  it('should return a signal with a valid contrast preference', () => {
    const sig = prefersContrast();
    expect(['no-preference', 'more', 'less', 'custom']).toContain(sig.value);
    sig.destroy();
  });

  it('should have a peek method', () => {
    const sig = prefersContrast();
    expect(['no-preference', 'more', 'less', 'custom']).toContain(sig.peek());
    sig.destroy();
  });

  it('should remove its media-query listeners on destroy', () => {
    const registeredHandlers = new Map<string, (event: MediaQueryListEvent) => void>();
    const removedQueries = new Set<string>();
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: query === '(prefers-contrast: more)',
        media: query,
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandlers.set(query, handler);
        },
        removeEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          if (registeredHandlers.get(query) === handler) {
            removedQueries.add(query);
          }
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersContrast();
      sig.destroy();
      expect(removedQueries).toEqual(
        new Set([
          '(prefers-contrast: more)',
          '(prefers-contrast: less)',
          '(prefers-contrast: custom)',
        ])
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('should react to custom contrast media-query changes', () => {
    const registeredHandlers = new Map<string, (event: MediaQueryListEvent) => void>();
    const states = new Map<string, boolean>([
      ['(prefers-contrast: more)', false],
      ['(prefers-contrast: less)', false],
      ['(prefers-contrast: custom)', false],
    ]);
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        get matches() {
          return states.get(query) ?? false;
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandlers.set(query, handler);
        },
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersContrast();
      expect(sig.value).toBe('no-preference');

      states.set('(prefers-contrast: custom)', true);
      registeredHandlers.get('(prefers-contrast: custom)')?.(
        new Event('change') as MediaQueryListEvent
      );

      expect(sig.value).toBe('custom');
      sig.destroy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('should reuse existing media-query list instances when updating contrast preference', () => {
    const registeredHandlers = new Map<string, (event: MediaQueryListEvent) => void>();
    const states = new Map<string, boolean>([
      ['(prefers-contrast: more)', false],
      ['(prefers-contrast: less)', false],
      ['(prefers-contrast: custom)', false],
    ]);
    const originalMatchMedia = window.matchMedia;
    let matchMediaCalls = 0;

    window.matchMedia = ((query: string) => {
      matchMediaCalls++;
      return {
        get matches() {
          return states.get(query) ?? false;
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandlers.set(query, handler);
        },
        removeEventListener: (
          _type: string,
          _handler: (event: MediaQueryListEvent) => void
        ) => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;

    try {
      const sig = prefersContrast();
      expect(matchMediaCalls).toBe(3);

      states.set('(prefers-contrast: more)', true);
      registeredHandlers.get('(prefers-contrast: more)')?.(
        new Event('change') as MediaQueryListEvent
      );

      expect(sig.value).toBe('more');
      expect(matchMediaCalls).toBe(3);
      sig.destroy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('should fall back to legacy listeners for contrast preference changes', () => {
    const registeredHandlers = new Map<
      string,
      (event: MediaQueryListEvent | MediaQueryList) => void
    >();
    const removedQueries = new Set<string>();
    const states = new Map<string, boolean>([
      ['(prefers-contrast: more)', false],
      ['(prefers-contrast: less)', false],
      ['(prefers-contrast: custom)', false],
    ]);
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        get matches() {
          return states.get(query) ?? false;
        },
        media: query,
        onchange: null,
        addEventListener: undefined,
        removeEventListener: undefined,
        addListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          registeredHandlers.set(query, handler);
        },
        removeListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          if (registeredHandlers.get(query) === handler) {
            removedQueries.add(query);
          }
        },
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = prefersContrast();

      states.set('(prefers-contrast: less)', true);
      registeredHandlers.get('(prefers-contrast: less)')?.({ matches: true } as MediaQueryList);

      expect(sig.value).toBe('less');

      sig.destroy();
      expect(removedQueries).toEqual(
        new Set([
          '(prefers-contrast: more)',
          '(prefers-contrast: less)',
          '(prefers-contrast: custom)',
        ])
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

// ─── auditA11y ───────────────────────────────────────────────────────────────

describe('a11y/auditA11y', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return passed for empty container', () => {
    const result = auditA11y(container);
    expect(result.passed).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('should detect images without alt', () => {
    container.innerHTML = '<img src="test.png" />';
    const result = auditA11y(container);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeGreaterThanOrEqual(1);
    const imgFinding = result.findings.find((f) => f.rule === 'img-alt');
    expect(imgFinding).toBeDefined();
    expect(imgFinding?.severity).toBe('error');
  });

  it('should accept images with alt text', () => {
    container.innerHTML = '<img src="test.png" alt="Test image" />';
    const result = auditA11y(container);
    const imgFindings = result.findings.filter((f) => f.rule === 'img-alt');
    expect(imgFindings.length).toBe(0);
  });

  it('should info on decorative images without role', () => {
    container.innerHTML = '<img src="test.png" alt="" />';
    const result = auditA11y(container);
    const decorativeFinding = result.findings.find((f) => f.rule === 'img-decorative');
    expect(decorativeFinding).toBeDefined();
    expect(decorativeFinding?.severity).toBe('info');
  });

  it('should not flag decorative images with role=presentation', () => {
    container.innerHTML = '<img src="test.png" alt="" role="presentation" />';
    const result = auditA11y(container);
    const decorativeFinding = result.findings.find((f) => f.rule === 'img-decorative');
    expect(decorativeFinding).toBeUndefined();
  });

  it('should detect form inputs without labels', () => {
    container.innerHTML = '<input type="text" />';
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeDefined();
    expect(inputFinding?.severity).toBe('error');
  });

  it('should accept inputs with label[for]', () => {
    container.innerHTML = `
      <label for="name">Name</label>
      <input type="text" id="name" />
    `;
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeUndefined();
  });

  it('should accept inputs with aria-label', () => {
    container.innerHTML = '<input type="text" aria-label="Search" />';
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeUndefined();
  });

  it('should accept inputs wrapped in label', () => {
    container.innerHTML = '<label>Name <input type="text" /></label>';
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeUndefined();
  });

  it('should skip hidden inputs', () => {
    container.innerHTML = '<input type="hidden" name="token" />';
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeUndefined();
  });

  it('should skip submit buttons', () => {
    container.innerHTML = '<input type="submit" value="Go" />';
    const result = auditA11y(container);
    const inputFinding = result.findings.find((f) => f.rule === 'input-label');
    expect(inputFinding).toBeUndefined();
  });

  it('should detect empty buttons', () => {
    container.innerHTML = '<button></button>';
    const result = auditA11y(container);
    const btnFinding = result.findings.find((f) => f.rule === 'button-name');
    expect(btnFinding).toBeDefined();
    expect(btnFinding?.severity).toBe('error');
  });

  it('should accept buttons with text', () => {
    container.innerHTML = '<button>Click me</button>';
    const result = auditA11y(container);
    const btnFinding = result.findings.find((f) => f.rule === 'button-name');
    expect(btnFinding).toBeUndefined();
  });

  it('should accept buttons with aria-label', () => {
    container.innerHTML = '<button aria-label="Close"></button>';
    const result = auditA11y(container);
    const btnFinding = result.findings.find((f) => f.rule === 'button-name');
    expect(btnFinding).toBeUndefined();
  });

  it('should detect empty links', () => {
    container.innerHTML = '<a href="#"></a>';
    const result = auditA11y(container);
    const linkFinding = result.findings.find((f) => f.rule === 'link-name');
    expect(linkFinding).toBeDefined();
    expect(linkFinding?.severity).toBe('error');
  });

  it('should accept links with text', () => {
    container.innerHTML = '<a href="#">Home</a>';
    const result = auditA11y(container);
    const linkFinding = result.findings.find((f) => f.rule === 'link-name');
    expect(linkFinding).toBeUndefined();
  });

  it('should accept links with image with alt', () => {
    container.innerHTML = '<a href="#"><img src="logo.png" alt="Logo" /></a>';
    const result = auditA11y(container);
    const linkFinding = result.findings.find((f) => f.rule === 'link-name');
    expect(linkFinding).toBeUndefined();
  });

  it('should detect skipped heading levels', () => {
    container.innerHTML = '<h1>Title</h1><h3>Subtitle</h3>';
    const result = auditA11y(container);
    const headingFinding = result.findings.find((f) => f.rule === 'heading-order');
    expect(headingFinding).toBeDefined();
    expect(headingFinding?.severity).toBe('warning');
  });

  it('should accept sequential heading levels', () => {
    container.innerHTML = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const result = auditA11y(container);
    const headingFinding = result.findings.find((f) => f.rule === 'heading-order');
    expect(headingFinding).toBeUndefined();
  });

  it('should detect empty headings', () => {
    container.innerHTML = '<h2></h2>';
    const result = auditA11y(container);
    const emptyHeading = result.findings.find((f) => f.rule === 'heading-empty');
    expect(emptyHeading).toBeDefined();
    expect(emptyHeading?.severity).toBe('warning');
  });

  it('should detect broken aria-labelledby references', () => {
    container.innerHTML = '<div aria-labelledby="nonexistent">Content</div>';
    const result = auditA11y(container);
    const ariaFinding = result.findings.find((f) => f.rule === 'aria-labelledby-ref');
    expect(ariaFinding).toBeDefined();
    expect(ariaFinding?.severity).toBe('error');
  });

  it('should accept valid aria-labelledby references', () => {
    container.innerHTML = `
      <span id="valid-label">My Label</span>
      <div aria-labelledby="valid-label">Content</div>
    `;
    const result = auditA11y(container);
    const ariaFinding = result.findings.find((f) => f.rule === 'aria-labelledby-ref');
    expect(ariaFinding).toBeUndefined();
  });

  it('should detect broken aria-describedby references', () => {
    container.innerHTML = '<input aria-describedby="nonexistent" />';
    const result = auditA11y(container);
    const ariaFinding = result.findings.find((f) => f.rule === 'aria-describedby-ref');
    expect(ariaFinding).toBeDefined();
  });

  it('should return correct error and warning counts', () => {
    container.innerHTML = `
      <img src="test.png" />
      <button></button>
      <h1>Title</h1><h3>Skipped</h3>
    `;
    const result = auditA11y(container);
    expect(result.errors).toBeGreaterThanOrEqual(2); // img-alt + button-name
    expect(result.warnings).toBeGreaterThanOrEqual(1); // heading-order
    expect(result.passed).toBe(false);
  });

  it('should audit document body by default', () => {
    document.body.innerHTML = '<img src="test.png" />';
    const result = auditA11y();
    const imgFinding = result.findings.find((f) => f.rule === 'img-alt');
    expect(imgFinding).toBeDefined();
    document.body.innerHTML = '';
  });

  it('should include element references in findings', () => {
    container.innerHTML = '<img src="test.png" />';
    const result = auditA11y(container);
    const imgFinding = result.findings.find((f) => f.rule === 'img-alt');
    expect(imgFinding?.element).toBeInstanceOf(Element);
    expect(imgFinding?.element.tagName).toBe('IMG');
  });

  it('should return an empty passing result when document.body is unavailable', () => {
    const originalBody = document.body;

    Object.defineProperty(document, 'body', {
      configurable: true,
      value: null,
    });

    try {
      const result = auditA11y();
      expect(result).toEqual({
        findings: [],
        errors: 0,
        warnings: 0,
        passed: true,
      });
    } finally {
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
    }
  });
});

// ─── Module exports ──────────────────────────────────────────────────────────

describe('a11y module exports', () => {
  it('should export trapFocus', () => {
    expect(typeof trapFocus).toBe('function');
  });

  it('should export releaseFocus', () => {
    expect(typeof releaseFocus).toBe('function');
  });

  it('should export getFocusableElements', () => {
    expect(typeof getFocusableElements).toBe('function');
  });

  it('should export announceToScreenReader', () => {
    expect(typeof announceToScreenReader).toBe('function');
  });

  it('should export clearAnnouncements', () => {
    expect(typeof clearAnnouncements).toBe('function');
  });

  it('should export rovingTabIndex', () => {
    expect(typeof rovingTabIndex).toBe('function');
  });

  it('should export skipLink', () => {
    expect(typeof skipLink).toBe('function');
  });

  it('should export prefersReducedMotion', () => {
    expect(typeof prefersReducedMotion).toBe('function');
  });

  it('should export prefersColorScheme', () => {
    expect(typeof prefersColorScheme).toBe('function');
  });

  it('should export prefersContrast', () => {
    expect(typeof prefersContrast).toBe('function');
  });

  it('should export auditA11y', () => {
    expect(typeof auditA11y).toBe('function');
  });
});
