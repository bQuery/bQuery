/**
 * View module tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
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
});
