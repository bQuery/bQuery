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
      else delete (proto as { moveBefore?: unknown }).moveBefore;
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

describe('morph release review, round 2 (1.18)', () => {
  const expectSame = (actual: unknown, expected: unknown): void => {
    expect(actual === expected).toBe(true);
  };
  const parse = (markup: string): DocumentFragment => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content;
  };

  it('keeps an unkeyed input when a sibling moves from after it to before it', () => {
    const cases: Array<[string, string]> = [
      [
        '\n<input>\n<small class="hint">8+ chars</small>\n',
        '\n<small class="err">Too short</small>\n<input>\n',
      ],
      ['<input><small>hint</small>', '<small>err</small><input>'],
      [
        '<label>L</label><input><small>hint</small><button>b</button>',
        '<label>L</label><small>err</small><input><button>b</button>',
      ],
      [
        '<input data-x="1"><li data-bq-key="a"></li>',
        '<li data-bq-key="a"></li><input data-x="1">',
      ],
    ];
    for (const [before, after] of cases) {
      const root = document.createElement('div');
      morphChildren(root, parse(before));
      const input = root.querySelector('input');

      morphChildren(root, parse(after));

      expect(root.innerHTML).toBe(after);
      expectSame(root.querySelector('input'), input);
    }
  });

  it('keeps a typed, focused input when its hint turns into an error above it', () => {
    const error = signal(false);
    const tag = uniqueTag('hint-error');
    component(tag, {
      signals: { error },
      render: ({ signals }) => html`
        <label>Password</label>
        ${signals.error.value ? '<small class="err">Too short</small>' : ''}
        <input class="pw" />
        ${signals.error.value ? '' : '<small class="hint">8+ characters</small>'}
        <button>Save</button>
      `,
    });
    const host = mount(tag);
    const input = $<HTMLInputElement>(host, 'input');
    input.value = 'abc';
    input.focus();

    error.value = true;

    expect($(host, '.err').textContent).toBe('Too short');
    expect($(host, '.hint')).toBeNull();
    expectSame($(host, 'input'), input);
    expect(input.value).toBe('abc');
    expectSame(host.shadowRoot!.activeElement, input);

    error.value = false;

    expect($(host, '.hint')).not.toBeNull();
    expectSame($(host, 'input'), input);
    host.remove();
  });

  it('drops a removed value attribute from options and checkboxes', () => {
    const root = document.createElement('div');
    morphChildren(
      root,
      parse(
        '<select><option value="a">A</option><option value="b">B</option></select>' +
          '<input type="checkbox" value="yes"><input type="hidden" value="h">'
      )
    );

    morphChildren(
      root,
      parse(
        '<select><option>A</option><option>B</option></select>' +
          '<input type="checkbox"><input type="hidden">'
      )
    );

    const select = root.querySelector('select')!;
    const [checkbox, hidden] = Array.from(root.querySelectorAll('input'));
    expect(select.options[0].hasAttribute('value')).toBe(false);
    expect(select.options[0].value).toBe('A');
    expect(select.value).toBe('A');
    expect(checkbox.hasAttribute('value')).toBe(false);
    expect(checkbox.value).toBe('on');
    expect(hidden.hasAttribute('value')).toBe(false);
    expect(hidden.value).toBe('');
  });

  it('does a bounded amount of work for rows that match nothing (perf)', () => {
    // Count sibling steps instead of timing, so the check is not flaky: an
    // unbounded positional scan is quadratic (~n²/2 steps for li → div).
    const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'nextSibling')!;
    let steps = 0;
    Object.defineProperty(Node.prototype, 'nextSibling', {
      ...descriptor,
      get(this: Node) {
        steps++;
        return descriptor.get!.call(this);
      },
    });
    const measure = (before: string, after: string): number => {
      const root = document.createElement('div');
      morphChildren(root, parse(before));
      const source = parse(after);
      steps = 0;
      morphChildren(root, source);
      expect(root.innerHTML).toBe(after);
      return steps;
    };
    try {
      const rows = (n: number, row: (i: number) => string, separator = ''): string =>
        Array.from({ length: n }, (_, i) => row(i)).join(separator);
      const n = 1000;
      // Tag switch: every <div> scans the remaining <li> rows.
      const tagSwitch = measure(
        rows(n, (i) => `<li>${i}</li>`, '\n'),
        rows(n, (i) => `<div>${i}</div>`, '\n')
      );
      // Keyed rows become unkeyed: no live row can be claimed positionally.
      const unkeyed = measure(
        rows(n, (i) => `<li data-bq-key="${i}">${i}</li>`),
        rows(n, (i) => `<li>${i}</li>`)
      );
      // Keyed reverse with whitespace between rows: each text node used to
      // scan over every pending keyed row.
      const m = 500;
      const reverse = measure(
        rows(m, (i) => `<li data-bq-key="${i}">${i}</li>`, '\n  '),
        rows(m, (i) => `<li data-bq-key="${m - 1 - i}">${m - 1 - i}</li>`, '\n  ')
      );
      expect(tagSwitch).toBeLessThan(40 * n);
      expect(unkeyed).toBeLessThan(40 * n);
      expect(reverse).toBeLessThan(40 * m);
    } finally {
      Object.defineProperty(Node.prototype, 'nextSibling', descriptor);
    }
  });

  it('does not keep re-inserting the siblings after a duplicate key', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const markup = (n: number): string =>
      `<li data-bq-key="a">1</li><li data-bq-key="a">2</li><input><p>${n}</p><span>x</span>`;
    morphChildren(root, parse(markup(0)));
    const input = root.querySelector('input')!;
    const span = root.querySelector('span')!;
    const inserted: string[] = [];
    const insertBefore = root.insertBefore.bind(root);
    root.insertBefore = <T extends Node>(node: T, child: Node | null): T => {
      inserted.push(node.nodeName.toLowerCase());
      return insertBefore(node, child);
    };

    morphChildren(root, parse(markup(1)));
    morphChildren(root, parse(markup(2)));

    expect(root.innerHTML).toBe(markup(2));
    expectSame(root.querySelector('input'), input);
    expectSame(root.querySelector('span'), span);
    // Only the unclaimable duplicate is recreated; nothing after it moves.
    expect(inserted).toEqual(['li', 'li']);
    root.remove();
  });

  it('does not re-render a signal-less component without on() handlers when it is moved', () => {
    let renders = 0;
    const tag = uniqueTag('replace-move');
    component(tag, {
      renderStrategy: 'replace',
      render: () => {
        renders++;
        return html`<input class="f" />`;
      },
    });
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const host = document.createElement(tag);
    first.appendChild(host);
    const input = $<HTMLInputElement>(host, 'input');
    input.value = 'typed';

    second.appendChild(host); // e.g. a drag-and-drop drop into another column

    expect(renders).toBe(1);
    expectSame($(host, 'input'), input);
    expect(input.value).toBe('typed');
    first.remove();
    second.remove();
  });

  it('restores on() handlers on reconnect without running updated() or rendering twice', () => {
    const log: string[] = [];
    let clicks = 0;
    const tag = uniqueTag('restore-quiet');
    component(tag, {
      state: { n: 0 },
      connected() {
        bindDelegatedEvents(this);
      },
      updated() {
        log.push('updated');
      },
      render: ({ state }) => {
        log.push('render');
        return html`<button ${onClick(() => (clicks += 1))}>${state.n}</button>`;
      },
    });
    const host = mount(tag);
    log.length = 0;

    host.remove();
    document.body.appendChild(host);
    $(host, 'button').click();

    expect(log).toEqual(['render']);
    expect(clicks).toBe(1);

    // A connected() hook that renders itself (setState) is not followed by a
    // second restoring render.
    const tag2 = uniqueTag('restore-setstate');
    component(tag2, {
      state: { n: 0 },
      connected() {
        bindDelegatedEvents(this);
        (this as unknown as { setState(k: string, v: number): void }).setState(
          'n',
          ((this as unknown as { getState(k: string): number }).getState('n') ?? 0) + 1
        );
      },
      render: ({ state }) => {
        log.push(`render ${state.n}`);
        return html`<button ${onClick(() => (clicks += 1))}>${state.n}</button>`;
      },
    });
    const host2 = mount(tag2);
    log.length = 0;

    host2.remove();
    document.body.appendChild(host2);
    $(host2, 'button').click();

    expect(log).toEqual(['render 2']);
    expect(clicks).toBe(2);
    host.remove();
    host2.remove();
  });

  it('runs an on() handler once when nested shadow:false hosts both delegate', () => {
    const clicks: string[] = [];
    const count = signal(0);
    const inner = uniqueTag('nested-inner');
    component(inner, {
      shadow: false,
      connected() {
        bindDelegatedEvents(this);
      },
      render: () => html`<button class="ib" ${onClick(() => clicks.push('inner'))}>i</button>`,
    });
    const outer = uniqueTag('nested-outer');
    component(outer, {
      shadow: false,
      signals: { count },
      sanitize: { allowTags: [inner] },
      connected() {
        bindDelegatedEvents(this);
      },
      render: ({ signals }) =>
        html`<p ${onClick(() => clicks.push('outer'))}>${signals.count.value}</p>
          <${inner}>placeholder</${inner}>`,
    });
    const host = mount(outer);
    host.querySelector<HTMLElement>('.ib')!.click();
    expect(clicks).toEqual(['inner']);

    count.value = 1;
    clicks.length = 0;
    host.querySelector<HTMLElement>('.ib')!.click();
    host.querySelector<HTMLElement>('p')!.click();
    expect(clicks).toEqual(['inner', 'outer']);

    host.remove();
    document.body.appendChild(host);
    clicks.length = 0;
    host.querySelector<HTMLElement>('.ib')!.click();
    host.querySelector<HTMLElement>('p')!.click();
    expect(clicks).toEqual(['inner', 'outer']);
    host.remove();
  });

  it('still dispatches a nested shadow:false child that does not delegate itself', () => {
    const clicks: string[] = [];
    const inner = uniqueTag('nested-plain');
    component(inner, {
      shadow: false,
      render: () => html`<button ${onClick(() => clicks.push('inner'))}>i</button>`,
    });
    const outer = uniqueTag('nested-plain-outer');
    component(outer, {
      shadow: false,
      sanitize: { allowTags: [inner] },
      connected() {
        bindDelegatedEvents(this);
      },
      render: () => html`<p ${onClick(() => clicks.push('outer'))}>p</p><${inner}></${inner}>`,
    });
    const host = mount(outer);
    host.querySelector<HTMLElement>('button')!.click();
    host.querySelector<HTMLElement>('p')!.click();
    expect(clicks).toEqual(['inner', 'outer']);
    host.remove();
  });
});
