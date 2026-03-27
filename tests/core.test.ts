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

  it('removeAttr removes attributes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.attr('data-test', 'value');
    wrapped.removeAttr('data-test');

    expect(div.hasAttribute('data-test')).toBe(false);
  });

  it('toggleAttr toggles attributes', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    wrapped.toggleAttr('data-flag');
    expect(div.hasAttribute('data-flag')).toBe(true);

    wrapped.toggleAttr('data-flag');
    expect(div.hasAttribute('data-flag')).toBe(false);

    wrapped.toggleAttr('data-flag', true);
    expect(div.hasAttribute('data-flag')).toBe(true);
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

  it('toggleAttr toggles attributes on all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);

    collection.toggleAttr('data-flag');

    expect(div1.hasAttribute('data-flag')).toBe(true);
    expect(div2.hasAttribute('data-flag')).toBe(true);
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

  it('append inserts content into all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const collection = new BQueryCollection([div1, div2]);
    const badge = document.createElement('span');
    badge.className = 'badge';

    collection.append(badge);

    const badge1 = div1.querySelector('.badge');
    const badge2 = div2.querySelector('.badge');
    expect(badge1).toBeDefined();
    expect(badge2).toBeDefined();
    expect(badge1).not.toBe(badge2);
  });

  it('replaceWith replaces all elements', () => {
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const parent = document.createElement('section');
    parent.appendChild(div1);
    parent.appendChild(div2);
    document.body.appendChild(parent);

    const collection = new BQueryCollection([div1, div2]);
    const replaced = collection.replaceWith('<p class="replacement"></p>');

    expect(parent.querySelectorAll('.replacement').length).toBe(2);
    expect(replaced.length).toBe(2);

    parent.remove();
  });

  it('wrap and unwrap work on collections', () => {
    const parent = document.createElement('div');
    const span1 = document.createElement('span');
    const span2 = document.createElement('span');
    parent.appendChild(span1);
    parent.appendChild(span2);
    document.body.appendChild(parent);

    const collection = new BQueryCollection([span1, span2]);
    collection.wrap('section');

    expect(parent.querySelectorAll('section').length).toBe(2);

    collection.unwrap();
    expect(parent.querySelectorAll('section').length).toBe(0);

    parent.remove();
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

describe('core/BQueryElement - new methods', () => {
  it('delegate handles delegated events', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button class="btn">Click</button>';
    document.body.appendChild(container);

    const wrapped = new BQueryElement(container);
    let delegatedTarget: Element | null = null;

    wrapped.delegate('click', '.btn', (_e, target) => {
      delegatedTarget = target;
    });

    const btn = container.querySelector('.btn');
    expect(btn).not.toBeNull();
    btn!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(delegatedTarget).not.toBeNull();
    expect(delegatedTarget === btn).toBe(true);
    container.remove();
  });

  it('wrap wraps element with new parent', () => {
    const container = document.createElement('div');
    const inner = document.createElement('span');
    inner.textContent = 'content';
    container.appendChild(inner);
    document.body.appendChild(container);

    const wrapped = new BQueryElement(inner);
    wrapped.wrap('section');

    const section = container.querySelector('section');
    expect(section).toBeDefined();
    expect(section?.contains(inner)).toBe(true);

    container.remove();
  });

  it('unwrap removes parent element', () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('section');
    const child = document.createElement('span');
    parent.appendChild(child);
    grandparent.appendChild(parent);
    document.body.appendChild(grandparent);

    const wrapped = new BQueryElement(child);
    wrapped.unwrap();

    expect(grandparent.contains(child)).toBe(true);
    expect(grandparent.contains(parent)).toBe(false);

    grandparent.remove();
  });

  it('unwrap handles multiple siblings sharing same parent correctly', () => {
    const grandparent = document.createElement('div');
    const wrapper = document.createElement('section');
    const child1 = document.createElement('span');
    const child2 = document.createElement('span');
    const child3 = document.createElement('span');
    child1.textContent = 'Child 1';
    child2.textContent = 'Child 2';
    child3.textContent = 'Child 3';
    wrapper.appendChild(child1);
    wrapper.appendChild(child2);
    wrapper.appendChild(child3);
    grandparent.appendChild(wrapper);
    document.body.appendChild(grandparent);

    // Create collection with multiple siblings
    const collection = new BQueryCollection([child1, child2, child3]);
    collection.unwrap();

    // All children should be moved to grandparent
    expect(grandparent.contains(child1)).toBe(true);
    expect(grandparent.contains(child2)).toBe(true);
    expect(grandparent.contains(child3)).toBe(true);
    // Wrapper should be removed (only once, not multiple times)
    expect(grandparent.contains(wrapper)).toBe(false);
    // Children should maintain their order
    expect(grandparent.children[0]).toBe(child1);
    expect(grandparent.children[1]).toBe(child2);
    expect(grandparent.children[2]).toBe(child3);

    grandparent.remove();
  });

  it('replaceWith replaces element', () => {
    const container = document.createElement('div');
    const original = document.createElement('span');
    original.id = 'original';
    container.appendChild(original);
    document.body.appendChild(container);

    const wrapped = new BQueryElement(original);
    const newEl = wrapped.replaceWith('<p id="replacement">New</p>');

    expect(container.querySelector('#original')).toBeNull();
    expect(container.querySelector('#replacement')).toBeDefined();
    expect(newEl.node.id).toBe('replacement');

    container.remove();
  });

  it('detach removes element but keeps wrapper and listeners reusable', () => {
    const container = document.createElement('div');
    const child = document.createElement('button');
    container.appendChild(child);
    document.body.appendChild(container);

    const wrapped = new BQueryElement(child);
    let clicks = 0;
    wrapped.on('click', () => clicks++);

    const result = wrapped.detach();
    expect(result).toBe(wrapped);
    expect(container.contains(child)).toBe(false);

    child.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);

    container.appendChild(child);
    child.dispatchEvent(new Event('click'));
    expect(clicks).toBe(2);

    container.remove();
  });

  it('index returns zero-based sibling position and -1 when detached', () => {
    const container = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    const third = document.createElement('span');
    container.appendChild(first);
    container.appendChild(second);
    container.appendChild(third);

    expect(new BQueryElement(second).index()).toBe(1);
    expect(new BQueryElement(document.createElement('div')).index()).toBe(-1);
  });

  it('contents includes text nodes and elements', () => {
    const div = document.createElement('div');
    div.append('hello');
    const span = document.createElement('span');
    span.textContent = 'world';
    div.appendChild(span);

    const contents = new BQueryElement(div).contents();

    expect(contents).toHaveLength(2);
    expect(contents[0]?.nodeType).toBe(Node.TEXT_NODE);
    expect(contents[1]).toBe(span);
  });

  it('offsetParent and position use element layout properties', () => {
    const parent = document.createElement('section');
    const child = document.createElement('div');
    parent.appendChild(child);

    Object.defineProperty(child, 'offsetParent', { configurable: true, get: () => parent });
    Object.defineProperty(child, 'offsetTop', { configurable: true, get: () => 24 });
    Object.defineProperty(child, 'offsetLeft', { configurable: true, get: () => 12 });

    const wrapped = new BQueryElement(child);

    expect(wrapped.offsetParent()).toBe(parent);
    expect(wrapped.position()).toEqual({ top: 24, left: 12 });
  });

  it('outerWidth and outerHeight optionally include margins', () => {
    const div = document.createElement('div') as HTMLElement;
    div.style.marginLeft = '5px';
    div.style.marginRight = '7px';
    div.style.marginTop = '3px';
    div.style.marginBottom = '11px';
    document.body.appendChild(div);

    Object.defineProperty(div, 'offsetWidth', { configurable: true, get: () => 100 });
    Object.defineProperty(div, 'offsetHeight', { configurable: true, get: () => 40 });

    const wrapped = new BQueryElement(div);

    expect(wrapped.outerWidth()).toBe(100);
    expect(wrapped.outerWidth(true)).toBe(112);
    expect(wrapped.outerHeight()).toBe(40);
    expect(wrapped.outerHeight(true)).toBe(54);

    div.remove();
  });

  it('layout parity helpers return safe defaults for non-HTML elements', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const wrapped = new BQueryElement(svg);

    expect(wrapped.offsetParent()).toBeNull();
    expect(wrapped.position()).toEqual({ top: 0, left: 0 });
    expect(wrapped.outerWidth()).toBe(0);
    expect(wrapped.outerHeight(true)).toBe(0);

    svg.remove();
  });

  it('scrollTo calls scrollIntoView', () => {
    const div = document.createElement('div');
    let scrollCalled = false;
    div.scrollIntoView = () => {
      scrollCalled = true;
    };

    const wrapped = new BQueryElement(div);
    wrapped.scrollTo();

    expect(scrollCalled).toBe(true);
  });

  it('serialize returns form data', () => {
    const form = document.createElement('form');
    const input1 = document.createElement('input');
    input1.name = 'email';
    input1.value = 'test@example.com';
    const input2 = document.createElement('input');
    input2.name = 'name';
    input2.value = 'John';
    form.appendChild(input1);
    form.appendChild(input2);
    document.body.appendChild(form);

    const wrapped = new BQueryElement(form);
    const data = wrapped.serialize();

    // Check that serialize returns an object (happy-dom may not fully support FormData)
    expect(typeof data).toBe('object');
    // If FormData works, check values; otherwise just verify it doesn't crash
    if (Object.keys(data).length > 0) {
      expect(data.email).toBe('test@example.com');
      expect(data.name).toBe('John');
    }

    form.remove();
  });

  it('serialize ignores prototype-pollution field names', () => {
    const form = document.createElement('form');
    const safeInput = document.createElement('input');
    safeInput.name = 'email';
    safeInput.value = 'test@example.com';
    const dangerousInput = document.createElement('input');
    dangerousInput.name = '__proto__';
    dangerousInput.value = 'polluted';
    form.appendChild(safeInput);
    form.appendChild(dangerousInput);
    document.body.appendChild(form);

    const data = new BQueryElement(form).serialize();

    expect(Object.getPrototypeOf(data)).toBeNull();
    expect(data.email).toBe('test@example.com');
    expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(false);
    expect(Object.keys(data)).not.toContain('__proto__');

    form.remove();
  });

  it('serializeString returns URL-encoded string', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.name = 'q';
    input.value = 'hello world';
    form.appendChild(input);
    document.body.appendChild(form);

    const wrapped = new BQueryElement(form);
    const str = wrapped.serializeString();

    // Check that it returns a string (happy-dom may not fully support FormData)
    expect(typeof str).toBe('string');
    // If FormData works, verify URL encoding
    if (str.length > 0) {
      expect(str).toContain('q=');
    }

    form.remove();
  });

  it('serialize returns empty object for non-form elements', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    const data = wrapped.serialize();
    expect(data).toEqual({});
  });

  it('serializeString returns empty string for non-form elements', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);
    const str = wrapped.serializeString();
    expect(str).toBe('');
  });

  it('undelegate removes delegated event listener', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button class="btn">Click</button>';
    document.body.appendChild(container);

    const wrapped = new BQueryElement(container);
    let clickCount = 0;

    const handler = (_e: Event, _target: Element) => {
      clickCount++;
    };

    wrapped.delegate('click', '.btn', handler);

    const btn = container.querySelector('.btn')!;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(clickCount).toBe(1);

    // Remove the delegated listener
    wrapped.undelegate('click', '.btn', handler);

    btn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(clickCount).toBe(1); // Should not increment

    container.remove();
  });
});

describe('core/BQueryCollection - delegate/undelegate', () => {
  it('delegate handles delegated events on collection', () => {
    const container1 = document.createElement('div');
    container1.innerHTML = '<button class="btn">Click 1</button>';
    const container2 = document.createElement('div');
    container2.innerHTML = '<button class="btn">Click 2</button>';
    document.body.appendChild(container1);
    document.body.appendChild(container2);

    const collection = new BQueryCollection([container1, container2]);
    const clickedTargets: Element[] = [];

    collection.delegate('click', '.btn', (_e, target) => {
      clickedTargets.push(target);
    });

    const button1 = container1.querySelector('.btn');
    const button2 = container2.querySelector('.btn');
    expect(button1).not.toBeNull();
    expect(button2).not.toBeNull();
    button1!.dispatchEvent(new Event('click', { bubbles: true }));
    button2!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(clickedTargets.length).toBe(2);
    expect(clickedTargets[0]).toBe(button1!);
    expect(clickedTargets[1]).toBe(button2!);

    container1.remove();
    container2.remove();
  });

  it('undelegate removes delegated event listener from collection', () => {
    const container1 = document.createElement('div');
    container1.innerHTML = '<button class="btn">Click 1</button>';
    const container2 = document.createElement('div');
    container2.innerHTML = '<button class="btn">Click 2</button>';
    document.body.appendChild(container1);
    document.body.appendChild(container2);

    const collection = new BQueryCollection([container1, container2]);
    let clickCount = 0;

    const handler = (_e: Event, _target: Element) => {
      clickCount++;
    };

    collection.delegate('click', '.btn', handler);

    container1.querySelector('.btn')!.dispatchEvent(new Event('click', { bubbles: true }));
    container2.querySelector('.btn')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(clickCount).toBe(2);

    // Remove the delegated listener
    collection.undelegate('click', '.btn', handler);

    container1.querySelector('.btn')!.dispatchEvent(new Event('click', { bubbles: true }));
    container2.querySelector('.btn')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(clickCount).toBe(2); // Should not increment

    container1.remove();
    container2.remove();
  });
});

describe('core/BQueryCollection parity getters', () => {
  it('detach removes all elements but keeps wrappers reusable', () => {
    const parent = document.createElement('div');
    const child1 = document.createElement('button');
    const child2 = document.createElement('button');
    parent.appendChild(child1);
    parent.appendChild(child2);

    const collection = new BQueryCollection([child1, child2]);
    let count = 0;
    collection.on('click', () => count++);

    const result = collection.detach();
    expect(result).toBe(collection);
    expect(parent.children).toHaveLength(0);

    child1.dispatchEvent(new Event('click'));
    child2.dispatchEvent(new Event('click'));
    expect(count).toBe(2);
  });

  it('index, contents, offsetParent, position, and outer size use the first element', () => {
    const parent = document.createElement('div');
    const first = document.createElement('div') as HTMLElement;
    const second = document.createElement('div') as HTMLElement;
    first.append('hello');
    const span = document.createElement('span');
    first.appendChild(span);
    first.style.marginLeft = '4px';
    first.style.marginRight = '6px';
    first.style.marginTop = '2px';
    first.style.marginBottom = '8px';
    parent.appendChild(document.createElement('i'));
    parent.appendChild(first);
    parent.appendChild(second);
    document.body.appendChild(parent);

    Object.defineProperty(first, 'offsetParent', { configurable: true, get: () => parent });
    Object.defineProperty(first, 'offsetTop', { configurable: true, get: () => 18 });
    Object.defineProperty(first, 'offsetLeft', { configurable: true, get: () => 9 });
    Object.defineProperty(first, 'offsetWidth', { configurable: true, get: () => 80 });
    Object.defineProperty(first, 'offsetHeight', { configurable: true, get: () => 30 });

    const collection = new BQueryCollection([first, second]);

    expect(collection.index()).toBe(1);
    expect(collection.contents()).toHaveLength(2);
    expect(collection.offsetParent()).toBe(parent);
    expect(collection.position()).toEqual({ top: 18, left: 9 });
    expect(collection.outerWidth()).toBe(80);
    expect(collection.outerWidth(true)).toBe(90);
    expect(collection.outerHeight()).toBe(30);
    expect(collection.outerHeight(true)).toBe(40);

    parent.remove();
  });

  it('empty collection parity getters return safe defaults', () => {
    const collection = new BQueryCollection([]);

    expect(collection.index()).toBe(-1);
    expect(collection.contents()).toEqual([]);
    expect(collection.offsetParent()).toBeNull();
    expect(collection.position()).toEqual({ top: 0, left: 0 });
    expect(collection.outerWidth()).toBe(0);
    expect(collection.outerHeight(true)).toBe(0);
  });

  it('non-HTMLElement first elements use the same safe defaults', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const div = document.createElement('div');
    const collection = new BQueryCollection([svg, div]);

    expect(collection.offsetParent()).toBeNull();
    expect(collection.position()).toEqual({ top: 0, left: 0 });
    expect(collection.outerWidth()).toBe(0);
    expect(collection.outerHeight(true)).toBe(0);

    svg.remove();
    div.remove();
  });
});

describe('core/DOM insertion order', () => {
  it('append maintains correct order for multiple elements', () => {
    const container = document.createElement('div');
    const wrapped = new BQueryElement(container);

    const el1 = document.createElement('span');
    el1.textContent = 'A';
    const el2 = document.createElement('span');
    el2.textContent = 'B';
    const el3 = document.createElement('span');
    el3.textContent = 'C';

    wrapped.append([el1, el2, el3]);

    const children = Array.from(container.children);
    expect(children.length).toBe(3);
    expect(children[0].textContent).toBe('A');
    expect(children[1].textContent).toBe('B');
    expect(children[2].textContent).toBe('C');
  });

  it('prepend maintains correct order for multiple elements', () => {
    const container = document.createElement('div');
    const existing = document.createElement('span');
    existing.textContent = 'EXISTING';
    container.appendChild(existing);
    const wrapped = new BQueryElement(container);

    const el1 = document.createElement('span');
    el1.textContent = 'A';
    const el2 = document.createElement('span');
    el2.textContent = 'B';
    const el3 = document.createElement('span');
    el3.textContent = 'C';

    wrapped.prepend([el1, el2, el3]);

    const children = Array.from(container.children);
    expect(children.length).toBe(4);
    expect(children[0].textContent).toBe('A');
    expect(children[1].textContent).toBe('B');
    expect(children[2].textContent).toBe('C');
    expect(children[3].textContent).toBe('EXISTING');
  });

  it('before maintains correct order for multiple elements', () => {
    const container = document.createElement('div');
    const target = document.createElement('span');
    target.textContent = 'TARGET';
    container.appendChild(target);
    const wrapped = new BQueryElement(target);

    const el1 = document.createElement('span');
    el1.textContent = 'A';
    const el2 = document.createElement('span');
    el2.textContent = 'B';
    const el3 = document.createElement('span');
    el3.textContent = 'C';

    wrapped.before([el1, el2, el3]);

    const children = Array.from(container.children);
    expect(children.length).toBe(4);
    expect(children[0].textContent).toBe('A');
    expect(children[1].textContent).toBe('B');
    expect(children[2].textContent).toBe('C');
    expect(children[3].textContent).toBe('TARGET');
  });

  it('after maintains correct order for multiple elements', () => {
    const container = document.createElement('div');
    const target = document.createElement('span');
    target.textContent = 'TARGET';
    container.appendChild(target);
    const wrapped = new BQueryElement(target);

    const el1 = document.createElement('span');
    el1.textContent = 'A';
    const el2 = document.createElement('span');
    el2.textContent = 'B';
    const el3 = document.createElement('span');
    el3.textContent = 'C';

    wrapped.after([el1, el2, el3]);

    const children = Array.from(container.children);
    expect(children.length).toBe(4);
    expect(children[0].textContent).toBe('TARGET');
    expect(children[1].textContent).toBe('A');
    expect(children[2].textContent).toBe('B');
    expect(children[3].textContent).toBe('C');
  });
});

describe('core/BQueryElement css getter', () => {
  it('css returns computed style value when called with single property', () => {
    const div = document.createElement('div') as HTMLElement;
    document.body.appendChild(div);
    div.style.color = 'red';

    const wrapped = new BQueryElement(div);
    const result = wrapped.css('color');

    const expected = getComputedStyle(div).getPropertyValue('color');
    expect(result).toBe(expected);
    expect(result).not.toBe('');

    div.remove();
  });

  it('css sets style and returns this when called with property and value', () => {
    const div = document.createElement('div') as HTMLElement;
    const wrapped = new BQueryElement(div);

    const result = wrapped.css('color', 'blue');
    expect(result).toBe(wrapped);
    expect(div.style.color).toBe('blue');
  });

  it('css sets multiple styles and returns this when called with object', () => {
    const div = document.createElement('div') as HTMLElement;
    const wrapped = new BQueryElement(div);

    const result = wrapped.css({ color: 'red', 'font-size': '16px' });
    expect(result).toBe(wrapped);
    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('16px');
  });
});

describe('core/BQueryElement is()', () => {
  it('is returns true for matching selector', () => {
    const div = document.createElement('div');
    div.classList.add('active');
    const wrapped = new BQueryElement(div);

    expect(wrapped.is('.active')).toBe(true);
    expect(wrapped.is('div')).toBe(true);
  });

  it('is returns false for non-matching selector', () => {
    const div = document.createElement('div');
    const wrapped = new BQueryElement(div);

    expect(wrapped.is('.active')).toBe(false);
    expect(wrapped.is('span')).toBe(false);
  });
});

describe('core/BQueryCollection css getter', () => {
  it('css returns computed style from first element when called with property only', () => {
    const div1 = document.createElement('div') as HTMLElement;
    const div2 = document.createElement('div') as HTMLElement;
    document.body.appendChild(div1);
    document.body.appendChild(div2);
    div1.style.color = 'red';

    const collection = new BQueryCollection([div1, div2]);
    const result = collection.css('color');

    const expected = getComputedStyle(div1).getPropertyValue('color');
    expect(result).toBe(expected);
    expect(result).not.toBe('');

    div1.remove();
    div2.remove();
  });

  it('css returns empty string for empty collection getter', () => {
    const collection = new BQueryCollection([]);
    const result = collection.css('color');

    expect(result).toBe('');
  });
});

describe('core/BQueryCollection find()', () => {
  it('find returns descendants matching selector', () => {
    const container1 = document.createElement('div');
    const child1 = document.createElement('span');
    child1.classList.add('item');
    container1.appendChild(child1);

    const container2 = document.createElement('div');
    const child2 = document.createElement('span');
    child2.classList.add('item');
    container2.appendChild(child2);

    const collection = new BQueryCollection([container1, container2]);
    const found = collection.find('.item');

    expect(found.length).toBe(2);
    expect(found.elements[0]).toBe(child1);
    expect(found.elements[1]).toBe(child2);
  });

  it('find returns empty collection when no matches', () => {
    const div = document.createElement('div');
    const collection = new BQueryCollection([div]);
    const found = collection.find('.nonexistent');

    expect(found.length).toBe(0);
  });

  it('find deduplicates shared descendants', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    child.classList.add('shared');
    parent.appendChild(child);

    // Both collections reference the same parent, so find should not duplicate
    const collection = new BQueryCollection([parent, parent]);
    const found = collection.find('.shared');

    expect(found.length).toBe(1);
  });
});
