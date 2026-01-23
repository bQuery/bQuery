# Core API

The core module provides selectors, DOM manipulation, events, and utilities. The API mirrors jQuery’s ergonomics while staying explicit and debuggable.

## Selectors

```ts
import { $, $$ } from '@bquery/bquery/core';

const button = $('#submit');
const items = $$('.list-item');
```

### `$` (single element)

- Accepts a selector string or an `Element`.
- Throws if a selector string matches no element.

```ts
const el = $('#app');
const wrap = $(document.body);
```

### `$$` (collection)

- Accepts a selector string, an array of `Element`, or `NodeListOf<Element>`.
- Always returns a `BQueryCollection` (empty if no matches).

```ts
const list = $$('.item');
const fromArray = $$([document.body]);
```

## BQueryElement (single element wrapper)

All mutating methods are chainable and return `this`.

### Class & attribute helpers

- `addClass(...classNames)`
- `removeClass(...classNames)`
- `toggleClass(className, force?)`
- `hasClass(className)`
- `attr(name, value?)`
- `prop(name, value?)`
- `data(name, value?)`

### Content & HTML

- `text(value?)`
- `html(value)` – sanitized by default
- `htmlUnsafe(value)` – bypasses sanitization
- `empty()`
- `append(content)`
- `prepend(content)`
- `before(content)`
- `after(content)`

> `content` can be a string (sanitized) or `Element`/`Element[]`.

### Style & visibility

- `css(property, value?)`
- `show(display?)`
- `hide()`
- `toggle(force?)`

### Events (Collection)

- `on(event, handler)`
- `once(event, handler)`
- `off(event, handler)`
- `trigger(event, detail?)`

### Traversal & utilities

- `find(selector)`
- `findOne(selector)`
- `closest(selector)`
- `parent()`
- `children()`
- `siblings()`
- `next()`
- `prev()`
- `matches(selector)`
- `clone(deep?)`
- `val(newValue?)`
- `rect()`
- `offset()`
- `focus()` / `blur()`
- `raw` (getter) / `node` (getter)

## BQueryCollection (multi-element wrapper)

All mutating methods are chainable and apply to every element. Getter methods return values from the first element.

### Collection helpers

- `length` (getter)
- `eq(index)`
- `firstEl()`
- `lastEl()`
- `each(callback)`
- `map(callback)`
- `filter(predicate)`
- `reduce(callback, initialValue)`
- `toArray()`

### DOM & class helpers

- `addClass(...classNames)`
- `removeClass(...classNames)`
- `toggleClass(className, force?)`
- `attr(name, value?)`
- `removeAttr(name)`
- `text(value?)`
- `html(value?)` – sanitized by default
- `htmlUnsafe(value)`
- `css(property, value?)`
- `show(display?)`
- `hide()`
- `remove()`
- `empty()`

### Events

- `on(event, handler)`
- `once(event, handler)`
- `off(event, handler)`
- `trigger(event, detail?)`

## Utilities

```ts
import { utils } from '@bquery/bquery/core';

const id = utils.uid();
const merged = utils.merge({ a: 1 }, { b: 2 });
```

### Utility list

- `clone(value)`
- `merge(...sources)`
- `debounce(fn, delayMs)`
- `throttle(fn, intervalMs)`
- `uid(prefix?)`
- `isElement(value)`
- `isCollection(value)`
- `isEmpty(value)`
- `isPlainObject(value)`
- `isFunction(value)`
- `isString(value)`
- `isNumber(value)`
- `isBoolean(value)`
- `isArray(value)`
- `parseJson(json, fallback)`
- `pick(obj, keys)`
- `omit(obj, keys)`
- `sleep(ms)`
- `randomInt(min, max)`
- `clamp(value, min, max)`
- `capitalize(str)`
- `toKebabCase(str)`
- `toCamelCase(str)`
