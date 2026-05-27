# Theme switcher

**Problem.** Persist the user's color-scheme choice and respect `prefers-color-scheme` on first visit.

**Solution.** Combine [`useStorage`](/guide/media) with [`usePreferredColorScheme`](/guide/media).

```ts
import { useStorage, usePreferredColorScheme } from '@bquery/bquery/media';
import { effect } from '@bquery/bquery/reactive';

const stored = useStorage<'light' | 'dark' | null>('theme', null);
const systemPref = usePreferredColorScheme();

const theme = () => stored.value ?? systemPref.value;

effect(() => {
  document.documentElement.dataset.theme = theme();
});

document.querySelector('#toggle')!.addEventListener('click', () => {
  stored.value = theme() === 'dark' ? 'light' : 'dark';
});
```

**Why it works.** `useStorage` syncs across tabs via the `storage` event; `usePreferredColorScheme` is a reactive media-query signal that flips when the OS-level preference changes.

## Related

- [Media — `useStorage`](/guide/media)
- [Media — `usePreferredColorScheme`](/guide/media)
- Longer worked example: [Examples & Recipes — Platform APIs](/guide/examples#platform-apis)
