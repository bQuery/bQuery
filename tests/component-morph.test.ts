import { describe, expect, it } from 'bun:test';
import { bindDelegatedEvents, component, html, keyedList, onClick } from '../src/component/index';
import { morphChildren } from '../src/component/morph';
import { signal } from '../src/reactive/index';

let counter = 0;
const uniqueTag = (name: string): string => `x-morph-${name}-${++counter}`;

const mount = (tag: string): HTMLElement => {
  const host = document.createElement(tag);
  document.body.appendChild(host);
  return host;
};

const $ = <T extends Element = HTMLElement>(host: HTMLElement, selector: string): T =>
  (host.shadowRoot ?? host).querySelector(selector) as T;

describe('component re-render morphing (#254)', () => {
  it('keeps typed input when an unrelated signal changes (issue reproduction)', () => {
    const count = signal(0);
    const tag = uniqueTag('probe');
    component(tag, {
      signals: { count },
      render: ({ signals }) => html`<input id="i" /><span>${signals.count.value}</span>`,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, '#i');
    input.value = 'typed';

    count.value = 1;

    expect($(host, '#i')).toBe(input);
    expect(input.value).toBe('typed');
    expect($(host, 'span').textContent).toBe('1');
    host.remove();
  });

  it('keeps the focused element focused', () => {
    const count = signal(0);
    const tag = uniqueTag('focus');
    component(tag, {
      signals: { count },
      render: ({ signals }) =>
        html`<p>${signals.count.value}</p>
          <input class="a" />`,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, 'input');
    input.focus();
    expect(host.shadowRoot!.activeElement).toBe(input);

    count.value = 5;

    expect(host.shadowRoot!.activeElement).toBe(input);
    host.remove();
  });

  it('keeps nodes after a conditionally removed sibling in place', () => {
    const show = signal(true);
    const tag = uniqueTag('conditional');
    component(tag, {
      signals: { show },
      render: ({ signals }) =>
        html`${signals.show.value ? '<h1>Title</h1>' : ''}
          <p>Body</p>
          <input />`,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, 'input');
    const paragraph = $(host, 'p');
    input.value = 'kept';

    show.value = false;
    expect($(host, 'h1')).toBeNull();
    expect($(host, 'p')).toBe(paragraph);
    expect($(host, 'input')).toBe(input);
    expect(input.value).toBe('kept');

    show.value = true;
    expect($(host, 'h1')?.textContent).toBe('Title');
    expect($(host, 'input')).toBe(input);
    host.remove();
  });

  it('applies attribute changes from the template and removes dropped attributes', () => {
    const variant = signal<'primary' | 'plain'>('primary');
    const tag = uniqueTag('attrs');
    component(tag, {
      signals: { variant },
      render: ({ signals }) =>
        signals.variant.value === 'primary'
          ? html`<button class="primary" title="Go">Go</button>`
          : html`<button class="plain">Go</button>`,
    });
    const host = mount(tag);
    const button = $(host, 'button');

    variant.value = 'plain';

    expect($(host, 'button')).toBe(button);
    expect(button.className).toBe('plain');
    expect(button.hasAttribute('title')).toBe(false);
    host.remove();
  });

  it('keeps attributes added at runtime, such as an opened <details>', () => {
    const count = signal(0);
    const tag = uniqueTag('details');
    component(tag, {
      signals: { count },
      render: ({ signals }) =>
        html`<details>
          <summary>More</summary>
          ${signals.count.value}
        </details>`,
    });
    const host = mount(tag);
    const details = $<HTMLDetailsElement>(host, 'details');
    details.setAttribute('open', '');

    count.value = 1;

    expect($(host, 'details')).toBe(details);
    expect(details.hasAttribute('open')).toBe(true);
    host.remove();
  });

  it('updates a controlled value and checked state when the template changes them', () => {
    const value = signal('a');
    const checked = signal(false);
    const tag = uniqueTag('controlled');
    component(tag, {
      signals: { value, checked },
      render: ({ signals }) =>
        html`<input class="text" value="${signals.value.value}" />
          <input class="box" type="checkbox" ${signals.checked.value ? 'checked' : ''} />`,
    });
    const host = mount(tag);
    const text = $<HTMLInputElement>(host, '.text');
    const box = $<HTMLInputElement>(host, '.box');

    value.value = 'b';
    checked.value = true;
    expect(text.value).toBe('b');
    expect(box.checked).toBe(true);

    checked.value = false;
    expect(box.checked).toBe(false);
    host.remove();
  });

  it('preserves a typed textarea value until the template changes its text', () => {
    const count = signal(0);
    const initial = signal('start');
    const tag = uniqueTag('textarea');
    component(tag, {
      signals: { count, initial },
      render: ({ signals }) =>
        html`<span>${signals.count.value}</span><textarea>${signals.initial.value}</textarea>`,
    });
    const host = mount(tag);
    const textarea = $<HTMLTextAreaElement>(host, 'textarea');
    textarea.value = 'typed';

    count.value = 1;
    expect($(host, 'textarea')).toBe(textarea);
    expect(textarea.value).toBe('typed');

    initial.value = 'reset';
    expect(textarea.value).toBe('reset');
    host.remove();
  });

  it('reorders keyed items without recreating them', () => {
    const items = signal([
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ]);
    const tag = uniqueTag('keyed');
    component(tag, {
      signals: { items },
      render: ({ signals }) =>
        html`<ul>
          ${keyedList(
            signals.items.value,
            (item) => item.id,
            (item) => `<li>${item.text}</li>`
          )}
        </ul>`,
    });
    const host = mount(tag);
    const before = Array.from(host.shadowRoot!.querySelectorAll('li'));

    items.value = [
      { id: 'c', text: 'C!' },
      { id: 'a', text: 'A' },
    ];

    const after = Array.from(host.shadowRoot!.querySelectorAll('li'));
    expect(after.map((li) => li.textContent)).toEqual(['C!', 'A']);
    expect(after[0]).toBe(before[2]);
    expect(after[1]).toBe(before[0]);
    host.remove();
  });

  it('does not reconnect nested custom elements', () => {
    const count = signal(0);
    let connects = 0;
    const child = uniqueTag('child');
    component(child, {
      connected() {
        connects += 1;
      },
      render: () => html`<b>child</b>`,
    });
    const tag = uniqueTag('parent');
    component(tag, {
      sanitize: { allowTags: [child] },
      signals: { count },
      render: ({ signals }) => html`<p>${signals.count.value}</p><${child}></${child}>`,
    });
    const host = mount(tag);
    expect(connects).toBe(1);

    count.value = 1;
    count.value = 2;

    expect(connects).toBe(1);
    host.remove();
  });

  it('skips the DOM write when the sanitized markup is unchanged', () => {
    const label = signal('same');
    const other = signal(0);
    const tag = uniqueTag('skip');
    component(tag, {
      signals: { label, other },
      render: ({ signals }) => {
        void signals.other.value;
        return html`<p>${signals.label.value}</p>`;
      },
    });
    const host = mount(tag);
    const paragraph = $(host, 'p');
    // A runtime change the template does not own survives an identical render.
    paragraph.dataset.touched = 'yes';
    paragraph.firstChild!.nodeValue = 'edited';

    other.value = 1;

    expect(paragraph.dataset.touched).toBe('yes');
    expect(paragraph.textContent).toBe('edited');
    host.remove();
  });

  it('keeps delegated event handlers working across morphs', () => {
    const count = signal(0);
    const tag = uniqueTag('events');
    component(tag, {
      signals: { count },
      connected() {
        bindDelegatedEvents(this);
      },
      render: ({ signals }) =>
        html`<button
          ${onClick(() => {
            count.value += 1;
          })}
        >
          ${signals.count.value}
        </button>`,
    });
    const host = mount(tag);
    const button = $(host, 'button');

    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }));

    expect(count.value).toBe(2);
    expect($(host, 'button')).toBe(button);
    expect(button.textContent?.trim()).toBe('2');
    host.remove();
  });

  it('keeps a single component <style> element first', () => {
    const count = signal(0);
    const tag = uniqueTag('styles');
    component(tag, {
      signals: { count },
      styles: 'p { color: red; }',
      render: ({ signals }) => html`<p>${signals.count.value}</p>`,
    });
    const host = mount(tag);
    const style = host.shadowRoot!.querySelector('style');

    count.value = 1;

    const styles = host.shadowRoot!.querySelectorAll('style');
    expect(styles.length).toBe(1);
    expect(styles[0]).toBe(style!);
    expect(host.shadowRoot!.firstChild).toBe(style);
    expect($(host, 'p').textContent).toBe('1');
    host.remove();
  });

  it('morphs light-DOM components too', () => {
    const count = signal(0);
    const tag = uniqueTag('light');
    component(tag, {
      shadow: false,
      signals: { count },
      render: ({ signals }) => html`<input /><span>${signals.count.value}</span>`,
    });
    const host = mount(tag);
    const input = host.querySelector('input')!;
    input.value = 'typed';

    count.value = 3;

    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('typed');
    expect(host.querySelector('span')!.textContent).toBe('3');
    host.remove();
  });

  it("recreates the tree with renderStrategy: 'replace'", () => {
    const count = signal(0);
    const tag = uniqueTag('replace');
    component(tag, {
      renderStrategy: 'replace',
      signals: { count },
      render: ({ signals }) => html`<input /><span>${signals.count.value}</span>`,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, 'input');
    input.value = 'typed';

    count.value = 1;

    expect($(host, 'input')).not.toBe(input);
    expect($<HTMLInputElement>(host, 'input').value).toBe('');
    host.remove();
  });
});

describe('morphChildren()', () => {
  const parse = (markup: string): HTMLTemplateElement => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template;
  };

  it('matches by id across reorders', () => {
    const root = document.createElement('div');
    morphChildren(root, parse('<p id="a">A</p><p id="b">B</p>').content);
    const [a, b] = Array.from(root.children);

    morphChildren(root, parse('<p id="b">B2</p><p id="a">A</p>').content);

    expect(Array.from(root.children)).toEqual([b, a]);
    expect(b.textContent).toBe('B2');
  });

  it('replaces a node whose tag changed', () => {
    const root = document.createElement('div');
    morphChildren(root, parse('<p>x</p>').content);
    const paragraph = root.firstElementChild;

    morphChildren(root, parse('<section>x</section>').content);

    expect(root.innerHTML).toBe('<section>x</section>');
    expect(root.firstElementChild).not.toBe(paragraph);
  });

  it('leaves preserved nodes untouched', () => {
    const root = document.createElement('div');
    const keep = document.createElement('aside');
    root.append(keep);

    morphChildren(root, parse('<p>x</p>').content, { preserve: (node) => node === keep });

    expect(root.firstChild).toBe(keep);
    expect(root.querySelector('p')?.textContent).toBe('x');
  });
});

describe('morph review follow-ups', () => {
  it('leaves the light DOM a nested shadow:false component rendered for itself', () => {
    const count = signal(0);
    const child = uniqueTag('light-child');
    component(child, { shadow: false, render: () => html`<b>child</b>` });
    const parent = uniqueTag('light-parent');
    component(parent, {
      sanitize: { allowTags: [child] },
      signals: { count },
      render: ({ signals }) => html`<p>${signals.count.value}</p><${child}></${child}>`,
    });
    const host = mount(parent);
    const nested = host.shadowRoot!.querySelector(child)!;
    expect(nested.innerHTML).toBe('<b>child</b>');

    count.value = 1;
    count.value = 2;

    expect(nested.innerHTML).toBe('<b>child</b>');
    expect($(host, 'p').textContent).toBe('2');
    host.remove();
  });

  it('keeps the event handlers of a nested shadow:false component across parent renders', () => {
    const count = signal(0);
    let clicks = 0;
    const child = uniqueTag('handler-child');
    component(child, {
      shadow: false,
      connected() {
        bindDelegatedEvents(this);
      },
      render: () => html`<button ${onClick(() => (clicks += 1))}>b</button>`,
    });
    const parent = uniqueTag('handler-parent');
    component(parent, {
      sanitize: { allowTags: [child], allowAttributes: ['data-bq-on-click'] },
      signals: { count },
      render: ({ signals }) => html`<p>${signals.count.value}</p><${child}></${child}>`,
    });
    const host = mount(parent);
    $(host, 'button').click();

    count.value = 1;
    $(host, 'button').click();

    expect(clicks).toBe(2);
    host.remove();
  });

  it('still updates and removes slotted children the template provides', () => {
    const label = signal<string | null>('first');
    const child = uniqueTag('slot-child');
    component(child, { render: () => html`<slot></slot>` });
    const parent = uniqueTag('slot-parent');
    component(parent, {
      sanitize: { allowTags: [child] },
      signals: { label },
      render: ({ signals }) =>
        signals.label.value === null
          ? html`<${child}></${child}>`
          : html`<${child}><i>${signals.label.value}</i></${child}>`,
    });
    const host = mount(parent);
    const nested = host.shadowRoot!.querySelector(child)!;
    expect(nested.textContent).toBe('first');

    label.value = 'second';
    expect(nested.textContent).toBe('second');

    label.value = null;
    expect(nested.childNodes.length).toBe(0);
    host.remove();
  });

  it('restores the template when code outside render replaced the root', () => {
    const tick = signal(0);
    const tag = uniqueTag('restore');
    component(tag, {
      signals: { tick },
      render: ({ signals }) => {
        void signals.tick.value; // re-renders, but the markup never changes
        return html`<p>content</p>`;
      },
    });
    const host = mount(tag);
    // e.g. an error fallback written straight into the shadow root
    host.shadowRoot!.innerHTML = '<p class="fallback">Error</p>';

    tick.value = 1;

    expect(host.shadowRoot!.querySelector('.fallback')).toBeNull();
    expect($(host, 'p').textContent).toBe('content');
    host.remove();
  });
});
