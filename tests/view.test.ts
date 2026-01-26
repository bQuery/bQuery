/**
 * View module tests
 */

import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test';
import { computed, signal } from '../src/reactive/index';
import { createTemplate, mount, type View } from '../src/view/index';

describe('View', () => {
  let container: HTMLElement;
  let view: View | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (view) {
      view.destroy();
      view = null;
    }
    container.remove();
  });

  describe('mount', () => {
    it('should mount to an element', () => {
      container.innerHTML = '<span bq-text="message"></span>';

      view = mount(container, {
        message: 'Hello',
      });

      expect(view.el).toBe(container);
      expect(container.querySelector('span')?.textContent).toBe('Hello');
    });

    it('should throw for non-existent selector', () => {
      expect(() => mount('#nonexistent', {})).toThrow('not found');
    });
  });

  describe('bq-text', () => {
    it('should bind text content', () => {
      container.innerHTML = '<p bq-text="content"></p>';
      const content = signal('Initial');

      view = mount(container, { content });

      expect(container.querySelector('p')?.textContent).toBe('Initial');

      content.value = 'Updated';
      expect(container.querySelector('p')?.textContent).toBe('Updated');
    });

    it('should work with computed values', () => {
      container.innerHTML = '<p bq-text="greeting"></p>';
      const name = signal('World');
      const greeting = computed(() => `Hello, ${name.value}!`);

      view = mount(container, { name, greeting });

      expect(container.querySelector('p')?.textContent).toBe('Hello, World!');

      name.value = 'bQuery';
      expect(container.querySelector('p')?.textContent).toBe('Hello, bQuery!');
    });
  });

  describe('bq-html', () => {
    it('should bind HTML content (sanitized)', () => {
      container.innerHTML = '<div bq-html="content"></div>';
      const content = signal('<strong>Bold</strong>');

      view = mount(container, { content });

      expect(container.querySelector('div')?.innerHTML).toBe('<strong>Bold</strong>');
    });

    it('should sanitize dangerous content by default', () => {
      container.innerHTML = '<div bq-html="content"></div>';
      const content = signal('<script>alert("xss")</script><p>Safe</p>');

      view = mount(container, { content });

      const html = container.querySelector('div')?.innerHTML;
      expect(html).not.toContain('<script>');
      expect(html).toContain('<p>Safe</p>');
    });
  });

  describe('bq-if', () => {
    it('should conditionally render elements', () => {
      container.innerHTML = '<div bq-if="show">Visible</div>';
      const show = signal(true);

      view = mount(container, { show });

      expect(container.querySelector('div')).not.toBeNull();

      show.value = false;
      expect(container.querySelector('div')).toBeNull();

      show.value = true;
      expect(container.querySelector('div')).not.toBeNull();
    });
  });

  describe('bq-show', () => {
    it('should toggle visibility', () => {
      container.innerHTML = '<div bq-show="visible">Content</div>';
      const visible = signal(true);

      view = mount(container, { visible });

      const div = container.querySelector('div') as HTMLElement;
      expect(div.style.display).not.toBe('none');

      visible.value = false;
      expect(div.style.display).toBe('none');

      visible.value = true;
      expect(div.style.display).not.toBe('none');
    });
  });

  describe('bq-class', () => {
    it('should bind object syntax classes', () => {
      container.innerHTML = '<div bq-class="{ active: isActive, disabled: isDisabled }"></div>';
      const isActive = signal(true);
      const isDisabled = signal(false);

      view = mount(container, { isActive, isDisabled });

      const div = container.querySelector('div')!;
      expect(div.classList.contains('active')).toBe(true);
      expect(div.classList.contains('disabled')).toBe(false);

      isActive.value = false;
      isDisabled.value = true;
      expect(div.classList.contains('active')).toBe(false);
      expect(div.classList.contains('disabled')).toBe(true);
    });

    it('should bind string class expressions', () => {
      container.innerHTML = '<div bq-class="className"></div>';
      const className = signal('primary');

      view = mount(container, { className });

      const div = container.querySelector('div')!;
      expect(div.classList.contains('primary')).toBe(true);
    });
  });

  describe('bq-style', () => {
    it('should bind inline styles', () => {
      container.innerHTML = '<div bq-style="{ color: textColor, fontSize: size }"></div>';
      const textColor = signal('red');
      const size = signal('16px');

      view = mount(container, { textColor, size });

      const div = container.querySelector('div') as HTMLElement;
      expect(div.style.color).toBe('red');
      expect(div.style.fontSize).toBe('16px');

      textColor.value = 'blue';
      expect(div.style.color).toBe('blue');
    });

    it('should remove stale styles when style object changes', () => {
      container.innerHTML = '<div bq-style="styleObj"></div>';
      const styleObj = signal({ color: 'red', fontSize: '16px' });

      view = mount(container, { styleObj });

      const div = container.querySelector('div') as HTMLElement;
      expect(div.style.color).toBe('red');
      expect(div.style.fontSize).toBe('16px');

      // Change to style object without fontSize
      styleObj.value = { color: 'blue' };
      expect(div.style.color).toBe('blue');
      // fontSize should be removed
      expect(div.style.fontSize).toBe('');
    });
  });

  describe('bq-model', () => {
    it('should bind input value two-way', () => {
      container.innerHTML = '<input bq-model="text" />';
      const text = signal('initial');

      view = mount(container, { text });

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('initial');

      // Update signal
      text.value = 'updated';
      expect(input.value).toBe('updated');

      // Simulate user input
      input.value = 'user input';
      input.dispatchEvent(new Event('input'));
      expect(text.value).toBe('user input');
    });

    it('should bind checkbox checked state', () => {
      container.innerHTML = '<input type="checkbox" bq-model="checked" />';
      const checked = signal(false);

      view = mount(container, { checked });

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.checked).toBe(false);

      checked.value = true;
      expect(input.checked).toBe(true);

      input.checked = false;
      input.dispatchEvent(new Event('input'));
      expect(checked.value).toBe(false);
    });
  });

  describe('bq-bind', () => {
    it('should bind attributes', () => {
      container.innerHTML = '<a bq-bind:href="url" bq-bind:title="tooltip">Link</a>';
      const url = signal('/home');
      const tooltip = signal('Go home');

      view = mount(container, { url, tooltip });

      const link = container.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('/home');
      expect(link.getAttribute('title')).toBe('Go home');

      url.value = '/about';
      expect(link.getAttribute('href')).toBe('/about');
    });

    it('should remove attribute for falsy values', () => {
      container.innerHTML = '<button bq-bind:disabled="isDisabled">Click</button>';
      const isDisabled = signal(true);

      view = mount(container, { isDisabled });

      const button = container.querySelector('button')!;
      expect(button.hasAttribute('disabled')).toBe(true);

      isDisabled.value = false;
      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('bq-on', () => {
    it('should bind event handlers', () => {
      container.innerHTML = '<button bq-on:click="handleClick">Click</button>';
      let clicked = false;

      view = mount(container, {
        handleClick: () => {
          clicked = true;
        },
      });

      const button = container.querySelector('button')!;
      button.click();

      expect(clicked).toBe(true);
    });

    it('should pass $event to handler', () => {
      container.innerHTML = '<button bq-on:click="handleClick($event)">Click</button>';
      let eventType = '';

      view = mount(container, {
        handleClick: (e: Event) => {
          eventType = e.type;
        },
      });

      const button = container.querySelector('button')!;
      button.click();

      expect(eventType).toBe('click');
    });

    it('should support signal mutations in event expressions', () => {
      container.innerHTML = `
        <div>
          <span bq-text="count"></span>
          <button id="increment" bq-on:click="count.value++">Increment</button>
          <button id="decrement" bq-on:click="count.value--">Decrement</button>
          <button id="add-five" bq-on:click="count.value += 5">Add 5</button>
        </div>
      `;
      const count = signal(0);

      view = mount(container, { count });

      const span = container.querySelector('span')!;
      const incrementBtn = container.querySelector('#increment')! as HTMLButtonElement;
      const decrementBtn = container.querySelector('#decrement')! as HTMLButtonElement;
      const addFiveBtn = container.querySelector('#add-five')! as HTMLButtonElement;

      // Initial value
      expect(span.textContent).toBe('0');
      expect(count.value).toBe(0);

      // Test increment
      incrementBtn.click();
      expect(count.value).toBe(1);
      expect(span.textContent).toBe('1');

      // Test increment again
      incrementBtn.click();
      expect(count.value).toBe(2);
      expect(span.textContent).toBe('2');

      // Test decrement
      decrementBtn.click();
      expect(count.value).toBe(1);
      expect(span.textContent).toBe('1');

      // Test compound assignment
      addFiveBtn.click();
      expect(count.value).toBe(6);
      expect(span.textContent).toBe('6');
    });
  });

  describe('bq-for', () => {
    it('should render lists', () => {
      container.innerHTML = '<ul><li bq-for="item in items" bq-text="item.name"></li></ul>';
      const items = signal([{ name: 'One' }, { name: 'Two' }, { name: 'Three' }]);

      view = mount(container, { items });

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(3);
      expect(listItems[0].textContent).toBe('One');
      expect(listItems[1].textContent).toBe('Two');
      expect(listItems[2].textContent).toBe('Three');
    });

    it('should update when list changes', () => {
      container.innerHTML = '<ul><li bq-for="item in items" bq-text="item"></li></ul>';
      const items = signal(['a', 'b']);

      view = mount(container, { items });

      expect(container.querySelectorAll('li').length).toBe(2);

      items.value = ['x', 'y', 'z'];
      expect(container.querySelectorAll('li').length).toBe(3);
    });

    it('should provide index variable', () => {
      container.innerHTML = '<ul><li bq-for="(item, index) in items" bq-text="index"></li></ul>';
      const items = signal(['a', 'b', 'c']);

      view = mount(container, { items });

      const listItems = container.querySelectorAll('li');
      expect(listItems[0].textContent).toBe('0');
      expect(listItems[1].textContent).toBe('1');
      expect(listItems[2].textContent).toBe('2');
    });

    describe('keyed reconciliation', () => {
      it('should reuse DOM elements with :key attribute', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
          { id: 3, name: 'Three' },
        ]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));
        expect(originalElements.length).toBe(3);

        // Update list - reorder items
        items.value = [
          { id: 3, name: 'Three' },
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
        ];

        const reorderedElements = Array.from(container.querySelectorAll('li'));
        expect(reorderedElements.length).toBe(3);

        // DOM elements should be reused (same references, different order)
        expect(reorderedElements[0]).toBe(originalElements[2]); // id=3 was at index 2
        expect(reorderedElements[1]).toBe(originalElements[0]); // id=1 was at index 0
        expect(reorderedElements[2]).toBe(originalElements[1]); // id=2 was at index 1
      });

      it('should support bq-key as alternative to :key', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" bq-key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 'a', name: 'Alpha' },
          { id: 'b', name: 'Beta' },
        ]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));

        items.value = [
          { id: 'b', name: 'Beta Updated' },
          { id: 'a', name: 'Alpha' },
        ];

        const reorderedElements = Array.from(container.querySelectorAll('li'));

        // Elements should be reused based on key
        expect(reorderedElements[0]).toBe(originalElements[1]); // id='b' was at index 1
        expect(reorderedElements[1]).toBe(originalElements[0]); // id='a' was at index 0
      });

      it('should only create new elements for new items', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
        ]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));

        // Add a new item
        items.value = [
          { id: 1, name: 'One' },
          { id: 3, name: 'Three' }, // New item
          { id: 2, name: 'Two' },
        ];

        const updatedElements = Array.from(container.querySelectorAll('li'));
        expect(updatedElements.length).toBe(3);

        // Original elements should be reused
        expect(updatedElements[0]).toBe(originalElements[0]); // id=1
        expect(updatedElements[2]).toBe(originalElements[1]); // id=2

        // New element was created for id=3
        expect(updatedElements[1]).not.toBe(originalElements[0]);
        expect(updatedElements[1]).not.toBe(originalElements[1]);
        expect(updatedElements[1].textContent).toBe('Three');
      });

      it('should remove elements for deleted items', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
          { id: 3, name: 'Three' },
        ]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));
        expect(originalElements.length).toBe(3);

        // Remove middle item
        items.value = [
          { id: 1, name: 'One' },
          { id: 3, name: 'Three' },
        ];

        const updatedElements = Array.from(container.querySelectorAll('li'));
        expect(updatedElements.length).toBe(2);

        // Remaining elements should be reused
        expect(updatedElements[0]).toBe(originalElements[0]); // id=1
        expect(updatedElements[1]).toBe(originalElements[2]); // id=3

        // Deleted element should no longer be in DOM
        expect(originalElements[1].parentNode).toBeNull();
      });

      it('should handle complete list replacement', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
        ]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));

        // Replace with completely different items
        items.value = [
          { id: 4, name: 'Four' },
          { id: 5, name: 'Five' },
        ];

        const newElements = Array.from(container.querySelectorAll('li'));
        expect(newElements.length).toBe(2);

        // All elements should be new
        expect(newElements[0]).not.toBe(originalElements[0]);
        expect(newElements[0]).not.toBe(originalElements[1]);
        expect(newElements[1]).not.toBe(originalElements[0]);
        expect(newElements[1]).not.toBe(originalElements[1]);

        // Old elements should be removed
        expect(originalElements[0].parentNode).toBeNull();
        expect(originalElements[1].parentNode).toBeNull();
      });

      it('should fallback to index-based keying without :key', () => {
        container.innerHTML = '<ul><li bq-for="item in items" bq-text="item.name"></li></ul>';
        const items = signal([{ name: 'One' }, { name: 'Two' }]);

        view = mount(container, { items });

        const originalElements = Array.from(container.querySelectorAll('li'));

        // Reorder - without keys, elements at same indices are reused
        items.value = [{ name: 'Two' }, { name: 'One' }];

        const updatedElements = Array.from(container.querySelectorAll('li'));

        // Elements at same indices are reused (index-based keying)
        expect(updatedElements[0]).toBe(originalElements[0]);
        expect(updatedElements[1]).toBe(originalElements[1]);
      });

      it('should handle empty list', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.id" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
        ]);

        view = mount(container, { items });

        expect(container.querySelectorAll('li').length).toBe(2);

        items.value = [];
        expect(container.querySelectorAll('li').length).toBe(0);

        // Re-add items
        items.value = [{ id: 3, name: 'Three' }];
        expect(container.querySelectorAll('li').length).toBe(1);
        expect(container.querySelector('li')?.textContent).toBe('Three');
      });

      it('should warn when duplicate keys are detected', () => {
        container.innerHTML =
          '<ul><li bq-for="item in items" :key="item.type" bq-text="item.name"></li></ul>';
        const items = signal([
          { id: 1, type: 'A', name: 'First' },
          { id: 2, type: 'B', name: 'Second' },
          { id: 3, type: 'A', name: 'Third' }, // Duplicate key 'A'
        ]);

        // Spy on console.warn
        const originalWarn = console.warn;
        const warnCalls: unknown[][] = [];
        console.warn = (...args: unknown[]) => {
          warnCalls.push(args);
        };

        try {
          view = mount(container, { items });
        } finally {
          // Restore console.warn even if test fails
          console.warn = originalWarn;
        }

        // Should have logged a warning about duplicate key
        expect(warnCalls.length).toBeGreaterThan(0);
        const duplicateKeyWarning = warnCalls.find((call) =>
          String(call[0]).includes('Duplicate key')
        );
        expect(duplicateKeyWarning).toBeDefined();
        const warningMessage = String(duplicateKeyWarning![0]);
        expect(warningMessage).toContain('"A"');
        expect(warningMessage).toContain('incorrect DOM reconciliation');
      });
    });

    it('should handle bq-for on root element without processing children twice', () => {
      // Create a fresh element to serve as the mount root with bq-for
      const rootElement = document.createElement('div');
      rootElement.setAttribute('bq-for', 'item in items');
      rootElement.innerHTML = '<span bq-text="item"></span>';
      container.appendChild(rootElement);

      const items = signal(['A', 'B', 'C']);

      view = mount(rootElement, { items });

      // Should render 3 root-level divs, each containing a span
      const renderedDivs = container.querySelectorAll('div');
      expect(renderedDivs.length).toBe(3);

      // Each div should have the correct text content in its span
      expect(renderedDivs[0].querySelector('span')?.textContent).toBe('A');
      expect(renderedDivs[1].querySelector('span')?.textContent).toBe('B');
      expect(renderedDivs[2].querySelector('span')?.textContent).toBe('C');

      // Update the list
      items.value = ['X', 'Y'];
      const updatedDivs = container.querySelectorAll('div');
      expect(updatedDivs.length).toBe(2);
      expect(updatedDivs[0].querySelector('span')?.textContent).toBe('X');
      expect(updatedDivs[1].querySelector('span')?.textContent).toBe('Y');
    });
  });

  describe('bq-ref', () => {
    it('should set element reference', () => {
      container.innerHTML = '<input bq-ref="inputEl" />';
      const inputEl = signal<Element | null>(null);

      view = mount(container, { inputEl });

      expect(inputEl.value).not.toBeNull();
      expect(inputEl.value?.tagName).toBe('INPUT');
    });
  });

  describe('createTemplate', () => {
    it('should create reusable template functions', () => {
      const TodoItem = createTemplate('<li bq-text="text"></li>');

      const item = TodoItem({ text: 'Buy milk' });

      expect(item.el.textContent).toBe('Buy milk');

      item.destroy();
    });

    it('should work with reactive values', () => {
      const Counter = createTemplate('<span bq-text="count"></span>');
      const count = signal(0);

      const counter = Counter({ count });

      expect(counter.el.textContent).toBe('0');

      count.value = 5;
      expect(counter.el.textContent).toBe('5');

      counter.destroy();
    });

    it('should reject templates with bq-for on root element', () => {
      const items = signal([1, 2, 3]);
      const BadTemplate = createTemplate('<li bq-for="item in items" bq-text="item"></li>');

      expect(() => BadTemplate({ items })).toThrow(
        /Template root element cannot have bq-for directive/
      );
    });
  });

  describe('destroy', () => {
    it('should cleanup effects', () => {
      container.innerHTML = '<p bq-text="text"></p>';
      const text = signal('Initial');

      view = mount(container, { text });

      expect(container.querySelector('p')?.textContent).toBe('Initial');

      view.destroy();

      // After destroy, updates should not apply
      text.value = 'Changed';
      // The text won't update because effect is cleaned up
      // (But the old value remains in DOM)
    });
  });

  describe('custom prefix', () => {
    it('should support custom directive prefix', () => {
      container.innerHTML = '<p x-text="message"></p>';

      view = mount(container, { message: 'Custom prefix' }, { prefix: 'x' });

      expect(container.querySelector('p')?.textContent).toBe('Custom prefix');
    });
  });

  describe('error handling', () => {
    let consoleErrorSpy: Mock<typeof console.error>;
    let consoleWarnSpy: Mock<typeof console.warn>;

    beforeEach(() => {
      consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
      consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('invalid expressions', () => {
      it('should log error for undefined variable in bq-text', () => {
        container.innerHTML = '<p bq-text="undefinedVar"></p>';

        view = mount(container, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error evaluating');
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('undefinedVar');
      });

      it('should log error for syntax error in expression', () => {
        container.innerHTML = '<p bq-text="invalid{{syntax"></p>';

        view = mount(container, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error evaluating');
      });

      it('should gracefully handle invalid expression and continue rendering', () => {
        container.innerHTML = `
          <p bq-text="invalidExpr"></p>
          <span bq-text="validExpr"></span>
        `;

        view = mount(container, { validExpr: 'Works!' });

        // First element with invalid expression renders empty (undefined coerced to '')
        expect(container.querySelector('p')?.textContent).toBe('');
        // Second element should still render correctly
        expect(container.querySelector('span')?.textContent).toBe('Works!');
      });

      it('should log error for invalid bq-class object expression', () => {
        container.innerHTML = '<div bq-class="{ active: nonExistent }"></div>';

        view = mount(container, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should log error for invalid bq-style expression', () => {
        container.innerHTML = '<div bq-style="{ color: missingColor }"></div>';

        view = mount(container, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should log error for invalid bq-bind expression', () => {
        container.innerHTML = '<a bq-bind:href="undefinedUrl">Link</a>';

        view = mount(container, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('undefinedUrl');
      });
    });

    describe('bq-model errors', () => {
      it('should warn when bq-model is bound to a non-signal value', () => {
        container.innerHTML = '<input bq-model="plainValue" />';

        view = mount(container, { plainValue: 'not a signal' });

        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('bq-model requires a signal');
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('plainValue');
      });

      it('should warn when bq-model is bound to undefined', () => {
        container.innerHTML = '<input bq-model="missingSignal" />';

        view = mount(container, {});

        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('bq-model requires a signal');
      });

      it('should warn when bq-model is bound to a computed (read-only)', () => {
        container.innerHTML = '<input bq-model="readOnlyValue" />';
        const count = signal(0);
        const readOnlyValue = computed(() => count.value * 2);

        view = mount(container, { readOnlyValue });

        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('bq-model requires a signal');
      });
    });

    describe('bq-for errors', () => {
      it('should log error for malformed bq-for expression without "in"', () => {
        container.innerHTML = '<ul><li bq-for="item items" bq-text="item"></li></ul>';

        view = mount(container, { items: signal(['a', 'b']) });

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Invalid bq-for expression');
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('item items');
      });

      it('should log error for empty bq-for expression', () => {
        container.innerHTML = '<ul><li bq-for="" bq-text="item"></li></ul>';

        view = mount(container, { items: signal(['a']) });

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Invalid bq-for expression');
      });

      it('should log error for bq-for with only variable name', () => {
        container.innerHTML = '<ul><li bq-for="item" bq-text="item"></li></ul>';

        view = mount(container, { items: signal(['a']) });

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Invalid bq-for expression');
      });

      it('should not render list items when bq-for expression is invalid', () => {
        container.innerHTML = '<ul><li bq-for="invalid syntax here" bq-text="item"></li></ul>';

        view = mount(container, { items: signal(['a', 'b', 'c']) });

        // Invalid syntax causes early return after logging error
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(
          consoleErrorSpy.mock.calls.some(
            (call: unknown[]) =>
              typeof call[0] === 'string' && call[0].includes('Invalid bq-for expression')
          )
        ).toBe(true);
      });

      it('should handle non-array values in bq-for gracefully', () => {
        container.innerHTML = '<ul><li bq-for="item in notAnArray" bq-text="item"></li></ul>';

        // Should not throw when mounting with undefined/non-array
        expect(() => {
          view = mount(container, { notAnArray: undefined });
        }).not.toThrow();

        // No items should be rendered for undefined
        expect(container.querySelectorAll('li').length).toBe(0);
      });
    });

    describe('bq-if errors', () => {
      it('should handle undefined condition gracefully', () => {
        container.innerHTML = '<div bq-if="undefinedCondition">Content</div>';

        view = mount(container, {});

        // Undefined is falsy, so element should be removed
        expect(container.querySelector('div')).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('bq-on errors', () => {
      it('should log error for undefined event handler', () => {
        container.innerHTML = '<button bq-on:click="undefinedHandler">Click</button>';

        view = mount(container, {});

        const button = container.querySelector('button')!;
        button.click();

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should handle non-function event handler gracefully', () => {
        container.innerHTML = '<button bq-on:click="notAFunction">Click</button>';

        view = mount(container, { notAFunction: 'string value' });

        const button = container.querySelector('button')!;

        // Should not throw when clicking
        expect(() => button.click()).not.toThrow();
      });
    });

    describe('bq-ref behavior', () => {
      it('should silently ignore non-signal ref targets', () => {
        container.innerHTML = '<input bq-ref="plainRef" />';

        // bq-ref with non-signal value is silently ignored (no error, just no-op)
        expect(() => {
          view = mount(container, { plainRef: null });
        }).not.toThrow();

        // No error should be logged - this is expected behavior
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should work with object having value property', () => {
        container.innerHTML = '<input bq-ref="refObj" />';
        const refObj = { value: null as Element | null };

        view = mount(container, { refObj });

        expect(refObj.value).not.toBeNull();
        expect(refObj.value?.tagName).toBe('INPUT');
      });

      it('should support nested object property access like refs.inputEl', () => {
        container.innerHTML = '<input bq-ref="refs.inputEl" />';
        const refs = {
          inputEl: { value: null as Element | null },
        };

        view = mount(container, { refs });

        expect(refs.inputEl.value).not.toBeNull();
        expect(refs.inputEl.value?.tagName).toBe('INPUT');

        // Verify cleanup works for nested refs
        view.destroy();
        expect(refs.inputEl.value).toBeNull();
      });

      it('should cleanup object refs on destroy to prevent memory leaks', () => {
        container.innerHTML = '<input bq-ref="refObj" />';
        const refObj = { value: null as Element | null };

        view = mount(container, { refObj });

        // Ref should be set after mount
        expect(refObj.value).not.toBeNull();
        expect(refObj.value?.tagName).toBe('INPUT');

        // Destroy the view
        view.destroy();

        // Ref should be cleared to prevent memory leaks
        expect(refObj.value).toBeNull();
      });
    });
  });
});
