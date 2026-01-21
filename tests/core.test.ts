import { describe, expect, it } from 'bun:test';
import { BQueryCollection } from '../src/core/collection';
import { BQueryElement } from '../src/core/element';
import { $, $$ } from '../src/core/selector';

describe('core/selector', () => {
  it('$ returns BQueryElement instance', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const result = $(div);
    expect(result).toBeInstanceOf(BQueryElement);

    div.remove();
  });

  it('$$ returns BQueryCollection from array', () => {
    const elements = [document.createElement('div'), document.createElement('span')];
    const result = $$(elements);

    expect(result).toBeInstanceOf(BQueryCollection);
    expect(result.elements.length).toBe(2);
  });

  it('$ throws for non-existent selector', () => {
    expect(() => $('#non-existent-element-12345')).toThrow();
  });
});

describe('core/BQueryElement', () => {
  it('exposes raw element', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    expect(wrapped.raw).toBe(div);
    expect(wrapped.node).toBe(div);
  });

  it('addClass adds classes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.addClass('test', 'another');

    expect(div.classList.contains('test')).toBe(true);
    expect(div.classList.contains('another')).toBe(true);
  });

  it('removeClass removes classes', () => {
    const div = document.createElement('div');
    div.classList.add('test', 'keep');
    const wrapped = new BQueryElement(div);

    wrapped.removeClass('test');

    expect(div.classList.contains('test')).toBe(false);
    expect(div.classList.contains('keep')).toBe(true);
  });

  it('toggleClass toggles classes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.toggleClass('active');
    expect(div.classList.contains('active')).toBe(true);

    wrapped.toggleClass('active');
    expect(div.classList.contains('active')).toBe(false);
  });

  it('toggleClass respects force parameter', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.toggleClass('active', true);
    wrapped.toggleClass('active', true);
    expect(div.classList.contains('active')).toBe(true);

    wrapped.toggleClass('active', false);
    expect(div.classList.contains('active')).toBe(false);
  });

  it('attr sets and gets attributes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.attr('data-test', 'value');
    expect(wrapped.attr('data-test')).toBe('value');
  });

  it('text sets and gets text content', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.text('Hello World');
    expect(wrapped.text()).toBe('Hello World');
  });

  it('css applies styles', () => {
    const div = document.createElement('div') as HTMLElement;
    const wrapped = new BQueryElement(div);

    wrapped.css('color', 'red');
    wrapped.css({ 'font-size': '16px', 'font-weight': 'bold' });

    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('16px');
    expect(div.style.fontWeight).toBe('bold');
  });

  it('on adds event listener', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    let clicked = false;

    wrapped.on('click', () => {
      clicked = true;
    });

    div.dispatchEvent(new Event('click'));
    expect(clicked).toBe(true);
  });

  it('off removes event listener', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    let count = 0;

    const handler = () => {
      count++;
    };

    wrapped.on('click', handler);
    div.dispatchEvent(new Event('click'));
    expect(count).toBe(1);

    wrapped.off('click', handler);
    div.dispatchEvent(new Event('click'));
    expect(count).toBe(1);
  });

  it('data reads and writes data attributes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.data('userId', '123');
    expect(wrapped.data('userId')).toBe('123');
    expect(div.getAttribute('data-user-id')).toBe('123');
  });

  it('methods are chainable', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    const result = wrapped.addClass('one').addClass('two').attr('id', 'test') as BQueryElement;
    result.text('Hello');

    expect(result).toBe(wrapped);
    expect(div.classList.contains('one')).toBe(true);
    expect(div.classList.contains('two')).toBe(true);
    expect(div.id).toBe('test');
    expect(div.textContent).toBe('Hello');
  });
});

describe('core/BQueryCollection', () => {
  it('stores elements array', () => {
    const elements = [document.createElement('div'), document.createElement('span')];
    const collection = new BQueryCollection(elements);

    expect(collection.elements).toEqual(elements);
    expect(collection.elements.length).toBe(2);
  });

  it('addClass applies to all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);

    collection.addClass('test');

    expect(div1.classList.contains('test')).toBe(true);
    expect(div2.classList.contains('test')).toBe(true);
  });

  it('removeClass applies to all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    div1.classList.add('test');
    div2.classList.add('test');
    const collection = new BQueryCollection([div1, div2]);

    collection.removeClass('test');

    expect(div1.classList.contains('test')).toBe(false);
    expect(div2.classList.contains('test')).toBe(false);
  });

  it('text sets text on all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);

    collection.text('Hello');

    expect(div1.textContent).toBe('Hello');
    expect(div2.textContent).toBe('Hello');
  });

  it('text returns the first element text', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    div1.textContent = 'First';
    div2.textContent = 'Second';
    const collection = new BQueryCollection([div1, div2]);

    expect(collection.text()).toBe('First');
  });

  it('attr returns the first element attribute', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    div1.setAttribute('data-test', 'one');
    div2.setAttribute('data-test', 'two');
    const collection = new BQueryCollection([div1, div2]);

    expect(collection.attr('data-test')).toBe('one');
  });

  it('html returns the first element HTML', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    div1.innerHTML = '<span>First</span>';
    div2.innerHTML = '<span>Second</span>';
    const collection = new BQueryCollection([div1, div2]);

    expect(collection.html()).toBe('<span>First</span>');
  });

  it('css applies styles to all elements', () => {
    const div1 = document.createElement('div') as HTMLElement;
    const div2 = document.createElement('div') as HTMLElement;
    const collection = new BQueryCollection([div1, div2]);

    collection.css('color', 'blue');
    collection.css({ 'font-size': '14px' });

    expect(div1.style.color).toBe('blue');
    expect(div2.style.color).toBe('blue');
    expect(div1.style.fontSize).toBe('14px');
    expect(div2.style.fontSize).toBe('14px');
  });

  it('on adds event listener to all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);
    let count = 0;

    collection.on('click', () => {
      count++;
    });

    div1.dispatchEvent(new Event('click'));
    div2.dispatchEvent(new Event('click'));

    expect(count).toBe(2);
  });

  it('methods are chainable', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);

    const result = collection.addClass('one').addClass('two').attr('data-test', 'value');

    expect(result).toBe(collection);
  });

  it('length returns element count', () => {
    const collection = new BQueryCollection([
      document.createElement('div'),
      document.createElement('span'),
      document.createElement('p'),
    ]);

    expect(collection.length).toBe(3);
  });

  it('eq returns wrapped element at index', () => {
    const div = document.createElement('div');
    const span = document.createElement('span');
    const collection = new BQueryCollection([div, span]);

    const first = collection.eq(0);
    const second = collection.eq(1);
    const outOfRange = collection.eq(5);

    expect(first?.raw).toBe(div);
    expect(second?.raw).toBe(span);
    expect(outOfRange).toBeUndefined();
  });

  it('each iterates over elements', () => {
    const elements = [document.createElement('div'), document.createElement('span')];
    const collection = new BQueryCollection(elements);
    const visited: BQueryElement[] = [];

    collection.each((el) => visited.push(el));

    expect(visited.map((el) => el.raw)).toEqual(elements);
  });

  it('map transforms elements', () => {
    const elements = [document.createElement('div'), document.createElement('span')];
    const collection = new BQueryCollection(elements);

    const tagNames = collection.map((el) => el.tagName);

    expect(tagNames).toEqual(['DIV', 'SPAN']);
  });

  it('filter creates new collection', () => {
    const div = document.createElement('div');
    const span = document.createElement('span');
    const collection = new BQueryCollection([div, span]);

    const divs = collection.filter((el) => el.tagName === 'DIV');

    expect(divs.length).toBe(1);
    expect(divs.elements[0]).toBe(div);
  });

  it('trigger dispatches custom events', () => {
    const div = document.createElement('div');
    const collection = new BQueryCollection([div]);
    let received = false;

    div.addEventListener('custom-event', () => {
      received = true;
    });

    collection.trigger('custom-event');
    expect(received).toBe(true);
  });

  it('show and hide control visibility', () => {
    const div = document.createElement('div') as HTMLElement;
    const collection = new BQueryCollection([div]);

    collection.hide();
    expect(div.style.display).toBe('none');

    collection.show();
    expect(div.style.display).toBe('');
  });

  it('empty clears content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span>Content</span>';
    const collection = new BQueryCollection([div]);

    collection.empty();
    expect(div.innerHTML).toBe('');
  });
});

describe('core/BQueryElement new methods', () => {
  it('hasClass checks for class presence', () => {
    const div = document.createElement('div');
    div.classList.add('active');
    const wrapped = new BQueryElement(div);

    expect(wrapped.hasClass('active')).toBe(true);
    expect(wrapped.hasClass('inactive')).toBe(false);
  });

  it('clone creates a copy', () => {
    const div = document.createElement('div');
    div.classList.add('original');
    div.innerHTML = '<span>Child</span>';
    const wrapped = new BQueryElement(div);

    const cloned = wrapped.clone();

    expect(cloned.raw).not.toBe(div);
    expect(cloned.hasClass('original')).toBe(true);
    expect((cloned.raw as HTMLElement).innerHTML).toBe('<span>Child</span>');
  });

  it('empty clears content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Content</p>';
    const wrapped = new BQueryElement(div);

    wrapped.empty();
    expect(div.innerHTML).toBe('');
  });

  it('show and hide control visibility', () => {
    const div = document.createElement('div') as HTMLElement;
    const wrapped = new BQueryElement(div);

    wrapped.hide();
    expect(div.style.display).toBe('none');

    wrapped.show();
    expect(div.style.display).toBe('');
  });

  it('toggle switches visibility', () => {
    const div = document.createElement('div') as HTMLElement;
    const wrapped = new BQueryElement(div);

    wrapped.hide();
    wrapped.toggle();
    expect(div.style.display).toBe('');

    wrapped.toggle(false);
    expect(div.style.display).toBe('none');
  });

  it('once adds one-time event listener', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    let count = 0;

    wrapped.once('click', () => count++);

    div.dispatchEvent(new Event('click'));
    div.dispatchEvent(new Event('click'));

    expect(count).toBe(1);
  });

  it('trigger dispatches custom event', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    let detail: unknown = null;

    div.addEventListener('custom', ((e: CustomEvent) => {
      detail = e.detail;
    }) as EventListener);

    wrapped.trigger('custom', { message: 'hello' });
    expect((detail as { message: string }).message).toBe('hello');
  });

  it('matches checks selector', () => {
    const div = document.createElement('div');
    div.classList.add('test-class');
    const wrapped = new BQueryElement(div);

    expect(wrapped.matches('.test-class')).toBe(true);
    expect(wrapped.matches('.other-class')).toBe(false);
  });

  it('val gets and sets form values', () => {
    const input = document.createElement('input') as HTMLInputElement;
    const wrapped = new BQueryElement(input);

    wrapped.val('test value');
    expect(input.value).toBe('test value');
    expect(wrapped.val()).toBe('test value');
  });

  it('children returns child elements', () => {
    const div = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('p');
    div.appendChild(child1);
    div.appendChild(child2);
    const wrapped = new BQueryElement(div);

    const children = wrapped.children();
    expect(children.length).toBe(2);
    expect(children).toContain(child1);
    expect(children).toContain(child2);
  });

  it('findOne returns first match', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span class="first"></span><span class="second"></span>';
    const wrapped = new BQueryElement(div);

    const found = wrapped.findOne('.first');
    expect(found?.classList.contains('first')).toBe(true);
  });
});
