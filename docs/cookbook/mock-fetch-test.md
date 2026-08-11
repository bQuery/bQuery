# Mock a fetch in tests

**Problem.** Test a component that calls `useFetch` without hitting the network.

**Solution.** Use [`mockFetch`](/guide/testing) from `@bquery/bquery/testing` to register typed responses.

```ts
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mockFetch, renderComponent, screen, cleanup } from '@bquery/bquery/testing';

describe('user list', () => {
  let mock: ReturnType<typeof mockFetch>;
  beforeEach(() => {
    mock = mockFetch();
  });
  afterEach(() => {
    mock.restore();
    cleanup();
  });

  it('renders fetched users', async () => {
    mock.on('GET', '/api/users', () => ({ status: 200, body: [{ id: 1, name: 'Ada' }] }));
    renderComponent('user-list');
    expect(await screen.findByText('Ada')).toBeTruthy();
  });
});
```

**Why it works.** `mockFetch` intercepts `globalThis.fetch` for the duration of the test; `cleanup()` (or `autoCleanup()` in setup) removes mounted DOM after each case.

## Related

- [Testing guide](/guide/testing)
- [Reactive — `useFetch`](/guide/reactive#fetch-composables)
- Longer worked example: [Examples & Recipes — Testing](/guide/examples#testing)
