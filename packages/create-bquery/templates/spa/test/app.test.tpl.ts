import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { navigate } from '@bquery/bquery/router';
import { fireEvent, screen, userEvent, waitFor, within } from '@bquery/bquery/testing';
import { createApp, type App } from '../src/app';
import { todos } from '../src/stores/todos';

let app: App;

/** The `<main>` element pages render into. */
const page = (): HTMLElement => document.querySelector<HTMLElement>('#page')!;

beforeEach(() => {
  history.replaceState(null, '', '/');
  todos.$reset();
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(root);
});

afterEach(() => {
  app.destroy();
  document.body.replaceChildren();
});

describe('app', () => {
  it('renders the todo page at /', async () => {
    await waitFor(() => document.title === 'Todos');
    expect(within(page()).getByRole('heading').textContent).toBe('Todos');
    expect(screen.getByText('0 of 0 left')).toBeTruthy();
  });

  it('adds, completes and deletes a todo', async () => {
    const input = (await screen.findByLabelText('New todo')) as HTMLInputElement;
    await userEvent.type(input, 'Write a test');
    // happy-dom does not turn a synthetic click on a submit button into a
    // submit event, so submit the form itself.
    fireEvent.submit(input.form!);

    expect(screen.getByText('Write a test')).toBeTruthy();
    expect(screen.getByText('1 of 1 left')).toBeTruthy();
    expect(input.value).toBe('');

    fireEvent(screen.getByRole('checkbox'), 'change');
    expect(todos.remaining).toBe(0);
    expect(screen.getByText('0 of 1 left')).toBeTruthy();

    const item = screen.getByText('Write a test').closest('li')!;
    await userEvent.click(within(item).getByRole('button'));
    expect(screen.queryByText('Write a test')).toBeNull();
  });

  it('navigates with <bq-link> and keeps the store', async () => {
    todos.add('Survive navigation');
    await waitFor(() => document.title === 'Todos');

    // `<bq-link>` follows real left clicks and Enter; the testing helpers'
    // `click` is a plain `Event` without a mouse button, so press Enter.
    fireEvent.keyDown(screen.getByText('About'), { key: 'Enter' });
    await waitFor(() => document.title === 'About');

    expect(location.pathname).toBe('/about');
    expect(within(page()).getByRole('heading').textContent).toBe('About');
    expect(screen.getByText('1 todo(s), 1 open.')).toBeTruthy();
  });

  it('shows a fallback page for unknown paths', async () => {
    await navigate('/missing');
    await waitFor(() => document.title === 'Not found');
    expect(within(page()).getByRole('heading').textContent).toBe('Page not found');
  });
});
