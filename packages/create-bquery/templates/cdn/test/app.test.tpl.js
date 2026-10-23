import { afterEach, describe, expect, it } from 'bun:test';
import { fireEvent, renderComponent, screen, waitFor, within } from '@bquery/bquery/testing';
import { mountGreeting } from '../app.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('greeting', () => {
  it('greets whoever types their name', () => {
    document.body.innerHTML = '<input id="name" /><p id="greeting"></p>';
    const { stop } = mountGreeting(document.body);
    expect(screen.getByText('Hello, stranger!')).toBeTruthy();

    // fireEvent sets the value, dispatches `input` and flushes effects.
    fireEvent.input(document.querySelector('#name'), 'Ada');
    expect(screen.getByText('Hello, Ada!')).toBeTruthy();
    stop();
  });
});

describe('<click-counter>', () => {
  it('renders its label and counts clicks', async () => {
    const { el, unmount } = renderComponent('click-counter', { props: { label: 'Taps' } });
    // `within()` and `screen` look inside shadow roots.
    const button = () => within(el).getByRole('button');
    expect(button().textContent).toBe('Taps: 0');

    fireEvent.click(button());
    fireEvent.click(button());
    await waitFor(() => button().textContent === 'Taps: 2');
    unmount();
  });
});
