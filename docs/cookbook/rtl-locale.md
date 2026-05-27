# RTL-aware localized layout

**Problem.** Switch direction and formats when the user picks an RTL locale.

**Solution.** Use [`isRTL`](/guide/i18n) plus [`setLocale`](/guide/i18n) and reactive formatters.

```ts
import { setLocale, currentLocale, isRTL, formatRelativeTime } from '@bquery/bquery/i18n';
import { effect } from '@bquery/bquery/reactive';

effect(() => {
  document.documentElement.lang = currentLocale.value;
  document.documentElement.dir = isRTL(currentLocale.value) ? 'rtl' : 'ltr';
});

await setLocale('ar');
console.log(formatRelativeTime(-2, 'hour')); // ‫قبل ساعتين‬
```

**Why it works.** Reading `currentLocale.value` inside an effect re-runs the `dir` switch every time the locale changes; `formatRelativeTime` defers to `Intl.RelativeTimeFormat` so output respects the active locale's plural rules.

## Related

- [i18n guide](/guide/i18n)
- [i18n — `negotiateLocale` / `detectLocale`](/guide/i18n)
- Longer worked example: [Examples & Recipes — Internationalization](/guide/examples#internationalization)
