/**
 * Component lifecycle, slot distribution, adopted stylesheets and in-place
 * re-rendering in a real browser engine.
 */

import { expect, test } from '@playwright/test';
import { FULL, openBlank } from './helpers';

test.beforeEach(async ({ page }) => openBlank(page));

// Slot names avoid `title`, `name` & co.: the sanitizer strips `name` values
// that would clobber `document` properties, slots included.
test('distributes named and default slots and runs the lifecycle', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { component, css, html } = await import(url);
    const log: string[] = [];
    component('x-card', {
      styles: css`
        .title {
          color: rgb(255, 0, 0);
        }
      `,
      connected() {
        log.push('connected');
      },
      disconnected() {
        log.push('disconnected');
      },
      render: () =>
        html`<h2 class="title"><slot name="heading"></slot></h2>
          <section><slot></slot></section>`,
    });

    const card = document.createElement('x-card');
    card.innerHTML = '<span slot="heading">Hello</span><p>Body</p><p>More</p>';
    document.getElementById('app')!.append(card);
    await new Promise(requestAnimationFrame);

    const root = card.shadowRoot!;
    const named = root.querySelector('slot[name="heading"]') as HTMLSlotElement;
    const fallback = root.querySelector('slot:not([name])') as HTMLSlotElement;
    const snapshot = {
      named: named.assignedNodes().map((node) => node.textContent),
      unnamed: fallback.assignedElements().map((node) => node.textContent),
      color: getComputedStyle(root.querySelector('.title')!).color,
      adoptedSheets: root.adoptedStyleSheets.length,
      styleElements: root.querySelectorAll('style').length,
    };
    card.remove();
    return { ...snapshot, log };
  }, FULL);

  expect(result.named).toEqual(['Hello']);
  expect(result.unnamed).toEqual(['Body', 'More']);
  expect(result.color).toBe('rgb(255, 0, 0)');
  expect(result.adoptedSheets).toBe(1);
  expect(result.styleElements).toBe(0);
  expect(result.log).toEqual(['connected', 'disconnected']);
});

test('upgrades an element that was in the DOM before its definition', async ({ page }) => {
  const text = await page.evaluate(async (url) => {
    document.getElementById('app')!.innerHTML = '<x-late name="Ada"></x-late>';
    const { component, html } = await import(url);
    component('x-late', {
      props: { name: { type: String, required: true } },
      render: ({ props }: { props: { name: string } }) => html`<b>Hi ${props.name}</b>`,
    });
    await customElements.whenDefined('x-late');
    return document.querySelector('x-late')!.shadowRoot!.textContent;
  }, FULL);
  expect(text).toBe('Hi Ada');
});

test('keeps typed input, focus and caret across a re-render (#254)', async ({ page }) => {
  await page.evaluate(async (url) => {
    const { component, html, signal } = await import(url);
    const count = signal(0);
    (window as unknown as { count: typeof count }).count = count;
    component('x-probe', {
      signals: { count },
      render: ({ signals }: { signals: { count: { value: number } } }) =>
        html`<input id="i" /><span>${signals.count.value}</span>`,
    });
    document.getElementById('app')!.innerHTML = '<x-probe></x-probe>';
  }, FULL);

  const input = page.locator('x-probe').locator('#i');
  await input.click();
  await input.pressSequentially('typed');
  await input.press('ArrowLeft');

  const state = await page.evaluate(() => {
    (window as unknown as { count: { value: number } }).count.value = 1;
    const root = document.querySelector('x-probe')!.shadowRoot!;
    const field = root.querySelector('#i') as HTMLInputElement;
    return {
      value: field.value,
      focused: root.activeElement === field,
      caret: field.selectionStart,
      counter: root.querySelector('span')!.textContent,
    };
  });

  expect(state).toEqual({ value: 'typed', focused: true, caret: 4, counter: '1' });
});

test('keeps an unkeyed input when a message appears before it (#254)', async ({ page }) => {
  await page.evaluate(async (url) => {
    const { component, html, signal } = await import(url);
    const error = signal(false);
    (window as unknown as { error: typeof error }).error = error;
    component('x-field', {
      signals: { error },
      render: ({ signals }: { signals: { error: { value: boolean } } }) => html`
        <label>Name</label>
        ${signals.error.value ? '<span class="err">Required</span>' : ''}
        <input class="field" />
        <button>Save</button>
      `,
    });
    document.getElementById('app')!.innerHTML = '<x-field></x-field>';
  }, FULL);

  const input = page.locator('x-field').locator('input');
  await input.click();
  await input.pressSequentially('typed');
  await input.press('ArrowLeft');

  const state = await page.evaluate(() => {
    const root = document.querySelector('x-field')!.shadowRoot!;
    const before = root.querySelector('input');
    (window as unknown as { error: { value: boolean } }).error.value = true;
    const field = root.querySelector('input') as HTMLInputElement;
    return {
      same: field === before,
      value: field.value,
      focused: root.activeElement === field,
      caret: field.selectionStart,
      message: root.querySelector('.err')?.textContent,
    };
  });

  expect(state).toEqual({
    same: true,
    value: 'typed',
    focused: true,
    caret: 4,
    message: 'Required',
  });
});

test('keyed reorder keeps child components and their handlers working', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { bindDelegatedEvents, component, html, keyedList, onClick, signal } = await import(url);
    const clicks: string[] = [];
    let connects = 0;
    component('x-row', {
      props: { label: { type: String, default: '' } },
      connected() {
        connects += 1;
        bindDelegatedEvents(this);
      },
      render: ({ props }: { props: { label: string } }) =>
        html`<button ${onClick(() => clicks.push(props.label))}>${props.label}</button>`,
    });
    const items = signal(['a', 'b', 'c']);
    component('x-rows', {
      sanitize: { allowTags: ['x-row'], allowAttributes: ['label'] },
      signals: { items },
      render: ({ signals }: { signals: { items: { value: string[] } } }) =>
        html`<ul>
          ${keyedList(
            signals.items.value,
            (item: string) => item,
            (item: string) => `<x-row label="${item}"></x-row>`
          )}
        </ul>`,
    });
    const host = document.createElement('x-rows');
    document.getElementById('app')!.append(host);
    const button = (label: string): HTMLButtonElement =>
      host
        .shadowRoot!.querySelector(`x-row[label="${label}"]`)!
        .shadowRoot!.querySelector('button') as HTMLButtonElement;
    const rows = Array.from(host.shadowRoot!.querySelectorAll('x-row'));

    items.value = ['c', 'a', 'b'];
    button('c').click();
    button('a').click();
    button('b').click();

    const after = Array.from(host.shadowRoot!.querySelectorAll('x-row'));
    return {
      clicks,
      sameNodes: after.every((row, index) => row === rows[[2, 0, 1][index]]),
      hasMoveBefore: 'moveBefore' in Element.prototype,
      connects,
    };
  }, FULL);

  expect(result.clicks).toEqual(['c', 'a', 'b']);
  expect(result.sameNodes).toBe(true);
  // With moveBefore() the moved row stays mounted; without it, one reconnect.
  expect(result.connects).toBe(result.hasMoveBefore ? 3 : 4);
});
