# Fade-in elements on scroll

**Problem.** Reveal sections as they enter the viewport, but only animate for users without reduced-motion.

**Solution.** Use [`inView`](/guide/motion) and respect [`prefersReducedMotion`](/guide/a11y).

```ts
import { inView, animate } from '@bquery/bquery/motion';
import { prefersReducedMotion } from '@bquery/bquery/a11y';

const reducedMotion = prefersReducedMotion();

document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
  inView(el, () => {
    if (reducedMotion.value) { el.style.opacity = '1'; return; }
    animate(el, { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0)'] }, { duration: 300 });
  }, { once: true });
});
```

**Why it works.** `inView` uses IntersectionObserver and only fires once per element when `{ once: true }`; reduced-motion users skip the keyframe animation entirely.

## Related

- [Motion — `inView`](/guide/motion)
- [Motion — `animate`](/guide/motion)
- [A11y — `prefersReducedMotion`](/guide/a11y)
- Longer worked example: [Examples & Recipes — Fade-in on scroll](/guide/examples#fade-in-elements-on-scroll)
