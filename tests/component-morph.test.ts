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

describe('morph release review (1.18)', () => {
  // Identity checks compare booleans: a failing `toBe(node)` would print the
  // whole happy-dom node graph.
  const expectSame = (actual: unknown, expected: unknown): void => {
    expect(actual === expected).toBe(true);
  };
  const parse = (markup: string): DocumentFragment => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content;
  };

  it('keeps an unkeyed input when a message is inserted before it', () => {
    const error = signal(false);
    const tag = uniqueTag('inserted-message');
    component(tag, {
      signals: { error },
      render: ({ signals }) => html`
        <label>Name</label>
        ${signals.error.value ? '<span class="err">Required</span>' : ''}
        <input class="field" />
        <button>Save</button>
      `,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, 'input');
    input.value = 'typed';
    input.focus();

    error.value = true;

    expect($(host, '.err').textContent).toBe('Required');
    expectSame($(host, 'input'), input);
    expect(input.value).toBe('typed');
    expectSame(host.shadowRoot!.activeElement, input);

    error.value = false;

    expect($(host, '.err')).toBeNull();
    expectSame($(host, 'input'), input);
    host.remove();
  });

  it('does not let a text node skip past an element it would orphan', () => {
    const root = document.createElement('div');
    morphChildren(root, parse('<p>a</p> <input> '));
    const input = root.querySelector('input');

    morphChildren(root, parse('<p>a</p> <b>x</b> <input> '));

    expect(root.innerHTML).toBe('<p>a</p> <b>x</b> <input> ');
    expectSame(root.querySelector('input'), input);

    // Also past the matcher's bounded lookahead: a long inserted run.
    const run = '<b>x</b> '.repeat(20);
    morphChildren(root, parse(`<p>a</p> ${run}<input> `));

    expect(root.innerHTML).toBe(`<p>a</p> ${run}<input> `);
    expectSame(root.querySelector('input'), input);
  });

  it('inserts an element in front of an unkeyed sibling instead of skipping it', () => {
    const root = document.createElement('div');
    morphChildren(root, parse('<input><div>footer</div>'));
    const input = root.querySelector('input');
    const footer = root.querySelector('div');

    morphChildren(root, parse('<div class="alert">x</div><input><div>footer</div>'));

    expect(root.innerHTML).toBe('<div class="alert">x</div><input><div>footer</div>');
    expectSame(root.querySelector('input'), input);
    expectSame(root.lastElementChild, footer);

    // …and removing it again keeps them too.
    morphChildren(root, parse('<input><div>footer</div>'));

    expect(root.innerHTML).toBe('<input><div>footer</div>');
    expectSame(root.querySelector('input'), input);
    expectSame(root.lastElementChild, footer);
  });

  it('always ends with the target markup (seeded fuzz)', () => {
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
    const node = (depth: number): string => {
      const roll = random();
      if (roll < 0.25) return pick([' ', 'a', 'b', '\n ']);
      if (roll < 0.3) return '<!--c-->';
      const tag = pick(['p', 'div', 'span', 'input', 'li']);
      const key =
        random() < 0.4
          ? ` data-bq-key="${pick(['1', '2', '3', '4'])}"`
          : random() < 0.2
            ? ` id="${pick(['x', 'y'])}"`
            : '';
      const cls = random() < 0.5 ? ` class="${pick(['c1', 'c2'])}"` : '';
      if (tag === 'input') return `<input${key}${cls}>`;
      const children =
        depth > 0
          ? Array.from({ length: Math.floor(random() * 4) }, () => node(depth - 1)).join('')
          : '';
      return `<${tag}${key}${cls}>${children}</${tag}>`;
    };
    const tree = (): string =>
      Array.from({ length: Math.floor(random() * 7) }, () => node(2)).join('');
    const normalize = (markup: string): string => {
      const element = document.createElement('div');
      element.innerHTML = markup;
      return element.innerHTML;
    };

    const failures: string[] = [];
    for (let run = 0; run < 400; run++) {
      const root = document.createElement('div');
      for (let step = 0; step < 5; step++) {
        const markup = tree();
        morphChildren(root, parse(markup));
        if (root.innerHTML !== normalize(markup)) failures.push(markup);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps on() handlers of child components moved by a keyed reorder', () => {
    const clicks: string[] = [];
    const child = uniqueTag('row');
    component(child, {
      props: { label: { type: String, default: '' } },
      connected() {
        bindDelegatedEvents(this);
      },
      render: ({ props }) =>
        html`<button ${onClick(() => clicks.push(String(props.label)))}>${props.label}</button>`,
    });
    const items = signal(['a', 'b', 'c']);
    const parent = uniqueTag('rows');
    component(parent, {
      sanitize: { allowTags: [child], allowAttributes: ['label'] },
      signals: { items },
      render: ({ signals }) =>
        html`<ul>
          ${keyedList(
            signals.items.value,
            (item) => item,
            (item) => `<${child} label="${item}"></${child}>`
          )}
        </ul>`,
    });
    const host = mount(parent);
    const button = (label: string): HTMLButtonElement =>
      host
        .shadowRoot!.querySelector(`${child}[label="${label}"]`)!
        .shadowRoot!.querySelector('button') as HTMLButtonElement;

    items.value = ['c', 'a', 'b'];
    button('c').click();
    button('a').click();
    button('b').click();

    expect(clicks).toEqual(['c', 'a', 'b']);
    host.remove();
  });

  it('re-renders a signal-less component on reconnect so its handlers work', () => {
    let clicks = 0;
    const tag = uniqueTag('reconnect-handlers');
    component(tag, {
      connected() {
        bindDelegatedEvents(this);
      },
      render: () => html`<button ${onClick(() => (clicks += 1))}>b</button>`,
    });
    const host = mount(tag);
    $(host, 'button').click();

    host.remove();
    document.body.appendChild(host);
    $(host, 'button').click();

    expect(clicks).toBe(2);
    host.remove();
  });

  it('moves keyed nodes with moveBefore() when the browser has it', () => {
    const proto = Element.prototype as Element & {
      moveBefore?: (node: Node, child: Node | null) => void;
    };
    const original = proto.moveBefore;
    const moved: Node[] = [];
    proto.moveBefore = function (this: Element, node: Node, child: Node | null) {
      moved.push(node);
      this.insertBefore(node, child);
    };
    try {
      const root = document.createElement('div');
      document.body.appendChild(root);
      morphChildren(root, parse('<p id="a">A</p><p id="b">B</p><p id="c">C</p>'));
      const c = root.querySelector('#c')!;

      morphChildren(root, parse('<p id="c">C</p><p id="a">A</p><p id="b">B</p>'));

      expectSame(root.firstElementChild, c);
      expect(moved.length).toBe(1);
      expectSame(moved[0], c);
      root.remove();
    } finally {
      if (original) proto.moveBefore = original;
      else delete proto.moveBefore;
    }
  });

  it('defines connectedMoveCallback so a moveBefore() keeps components mounted', () => {
    const tag = uniqueTag('move');
    component(tag, { render: () => html`<b>x</b>` });
    const ctor = customElements.get(tag)!;
    expect(typeof ctor.prototype.connectedMoveCallback).toBe('function');
  });

  it('leaves a shadow:false child its own render over placeholder children', () => {
    const count = signal(0);
    const child = uniqueTag('own-light');
    component(child, { shadow: false, render: () => html`<b>own</b>` });
    const parent = uniqueTag('own-light-parent');
    component(parent, {
      sanitize: { allowTags: [child] },
      signals: { count },
      render: ({ signals }) =>
        html`<p>${signals.count.value}</p>
          <${child}>Loading…</${child}>`,
    });
    const host = mount(parent);
    const nested = host.shadowRoot!.querySelector(child)!;
    expect(nested.innerHTML).toBe('<b>own</b>');

    count.value = 1;

    expectSame(host.shadowRoot!.querySelector(child), nested);
    expect(nested.innerHTML).toBe('<b>own</b>');
    expect($(host, 'p').textContent).toBe('1');
    host.remove();
  });

  it('does not re-assert a template attribute removed at runtime', () => {
    const count = signal(0);
    const tag = uniqueTag('collapsed');
    component(tag, {
      sanitize: { allowTags: ['details', 'summary'], allowAttributes: ['open'] },
      signals: { count },
      render: ({ signals }) =>
        html`<details open>
            <summary>More</summary>
            body
          </details>
          <p>${signals.count.value}</p>`,
    });
    const host = mount(tag);
    const details = $<HTMLDetailsElement>(host, 'details');
    expect(details.hasAttribute('open')).toBe(true);
    details.removeAttribute('open'); // the user collapsed it

    count.value = 1;

    expectSame($(host, 'details'), details);
    expect(details.hasAttribute('open')).toBe(false);
    host.remove();
  });
});
