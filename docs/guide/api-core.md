# Core API

The core module provides selectors, DOM manipulation, events, and utilities. The API mirrors jQuery’s ergonomics while staying explicit and debuggable. It is built on three building blocks:

- **`$(selector)`** — wraps a single element in a `BQueryElement` and **throws** if the selector matches nothing. Use it when the absence of the element is a bug.
- **`$$(selector)`** — wraps any number of elements (including zero) in a `BQueryCollection`. Use it for lists, optional matches, or iteration.
- **Utilities** — pure helpers (`debounce`, `throttle`, `merge`, `uid`, `template`, type guards, …) exposed both as named exports *and* via the `utils` namespace for IntelliSense-friendly destructuring.

All mutating methods return `this` so they chain. Read-only getters (`text()`, `attr(name)`, `css(prop)`, `val()`, etc.) return the underlying value. HTML insertion methods such as `html()`, `append()`, `prepend()`, `before()`, and `after()` sanitize string content by default, while setters like `attr()`, `data()`, and `css()` write directly; the [Security guide](./security.md) covers how to opt in to raw HTML when you genuinely need it.

> `BQueryElement` always wraps exactly one element. `BQueryCollection` wraps zero or more — its mutating methods apply to every element, and its getters read from the first element. Convert between them with `$$(...).eq(0)` or `collection.firstEl()`, both of which return `BQueryElement | undefined` when the collection is empty.

## Selectors

```ts
import { $, $$ } from '@bquery/bquery/core';

const button = $('#submit');
const items = $$('.list-item');
```

`$()` is the strict variant: missing elements raise an `Error` with the message `bQuery: element not found for selector "..."`, which surfaces typos and DOM-timing bugs at the call site instead of crashing later. `$$()` is the permissive variant: an empty collection is a valid result, and the chainable API on it becomes a safe no-op (`$$('.missing').addClass('x')` does nothing rather than throwing).

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

`BQueryElement` is the single-element wrapper returned by `$()`. Every method that *changes* the element returns `this` so calls can be chained fluently; every method that *reads* state returns a primitive (`string`, `number`, `boolean`, `DOMRect`, …). The underlying DOM node is always available via the `.raw` (alias `.node`) getter when you need to drop down to raw browser APIs.

### Class & attribute helpers

These helpers mirror standard `classList` / `setAttribute` semantics but stay chainable. `attr(name)` (single argument) returns the current attribute value as a `string`, using `''` when the attribute is missing; calling `attr(name, value)` sets it. `prop()` is the equivalent for IDL properties on the wrapped `Element`; in TypeScript, control-specific properties such as `checked` or `value` may require narrowing or casting the element type, or using the underlying `.raw` node directly. `data()` reads and writes `data-*` attributes with automatic key normalization.

- `addClass(...classNames)`
- `removeClass(...classNames)`
- `toggleClass(className, force?)`
- `hasClass(className)`
- `attr(name, value?)`
- `removeAttr(name)`
- `toggleAttr(name, force?)`
- `prop(name, value?)`
- `data(name, value?)`

### Content & HTML

`text()` reads or writes `textContent`, so any HTML in the input is rendered as plain text — this is the safest way to display user-supplied data. `html(value)` runs the input through the default sanitizer (see [Security](./security.md)) before assignment, removing scripts and dangerous attributes. `htmlUnsafe(value)` skips sanitization and is the explicit opt-in for trusted markup. Insertion helpers (`append`, `prepend`, `before`, `after`) accept either sanitized strings or DOM nodes; passing nodes preserves listeners and references.

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

`css()` is overloaded: with a single property name it acts as a **getter** that returns the resolved value from `getComputedStyle()` (always a `string`); with a property + value (or an object) it acts as a **setter** that writes to `element.style` and stays chainable. `show()` / `hide()` toggle the inline `display` style, and `show(display)` lets you opt into a specific display value (e.g. `'flex'`) instead of the browser default. `toggle()` flips visibility, or accepts a boolean `force` to set it explicitly.

- `css(property)` – getter: returns computed style value via `getComputedStyle()`
- `css(property, value)` – setter: sets a single CSS property
- `css(properties)` – setter: sets multiple CSS properties from an object
- `show(display?)`
- `hide()`
- `toggle(force?)`

### Events (Element)

`on()` attaches a listener that fires for every dispatched event of that type, `once()` auto-removes itself after the first invocation, and `off()` removes a previously attached handler (the exact function reference must match). `trigger()` synthesises and dispatches a `CustomEvent`, with the optional `detail` payload available on `event.detail`. `delegate()` is the preferred way to react to events on **dynamically inserted** descendants: a single listener on the wrapper element matches the inner `selector` at dispatch time, so newly added children are picked up automatically.

- `on(event, handler)`
- `once(event, handler)`
- `off(event, handler)`
- `trigger(event, detail?)`
- `delegate(event, selector, handler)` – event delegation for dynamic content

### Event Delegation

Event delegation allows handling events on dynamically added elements:

```ts
// Handle clicks on .item elements, even if added later
$('#list').delegate('click', '.item', (event, target) => {
  console.log('Clicked:', target.textContent);
});
```

### CSS Getter

The `css()` method works as a getter when called with a single property name:

```ts
// Get computed style value
const color = $('#box').css('color');

// Set styles (chainable)
$('#box').css('color', 'red');
$('#box').css({ color: 'red', 'font-size': '16px' });
```

### Selector Matching

```ts
if ($('#el').is('.active')) {
  console.log('Element is active');
}

// Equivalent to
$('#el').matches('.active');
```

### Traversal & utilities

Traversal methods follow the DOM tree without mutating the receiver, but their return types mirror the underlying DOM operation. On `BQueryElement`, `find()` returns **all** matching descendants as `Element[]`, `findOne()` returns the first match as `Element | null`, and helpers like `closest()`, `parent()`, `next()`, and `prev()` return raw `Element | null` values. On `BQueryCollection`, traversal helpers return new `BQueryCollection` wrappers so you can keep chaining across multiple matches. `closest()` walks **up** the tree (including the element itself when it matches), which is the canonical pattern for resolving the target of a `delegate('click', selector, …)` callback to a known ancestor.

Layout getters come in two flavours: `innerWidth`/`innerHeight` measure the content + padding box (matching `clientWidth`/`clientHeight`), while `outerWidth`/`outerHeight` measure the border box and accept an optional `includeMargin` boolean. `rect()` returns a live `DOMRect`, `offset()` returns `offsetWidth`/`offsetHeight` plus `offsetTop`/`offsetLeft` (relative to the offset parent), and `position()` returns coordinates relative to the offset parent.

- `find(selector)`
- `findOne(selector)`
- `closest(selector)`
- `parent()`
- `children()`
- `siblings()`
- `next()`
- `prev()`
- `matches(selector)`
- `is(selector)` – alias for `matches()`
- `clone(deep?)`
- `val(newValue?)`
- `rect()`
- `offset()`
- `index()`
- `contents()`
- `offsetParent()`
- `position()`
- `innerWidth()` – content + padding width (clientWidth)
- `innerHeight()` – content + padding height (clientHeight)
- `outerWidth(includeMargin?)` – border-box width, optionally with margins
- `outerHeight(includeMargin?)` – border-box height, optionally with margins
- `focus()` / `blur()`
- `raw` (getter) / `node` (getter)

### DOM Manipulation

- `wrap(wrapper)` – wrap element with new parent (accepts tag name or Element)
- `unwrap()` – remove parent, keeping element
- `replaceWith(content)` – replace element with new content
- `detach()` – remove element from DOM without discarding the wrapper
- `scrollTo(options?)` – scroll element into view

```ts
// Wrap element with a div
$('#content').wrap('div');

// Wrap with an existing element
const wrapper = document.createElement('section');
wrapper.className = 'wrapper';
$('#content').wrap(wrapper);

// Unwrap (remove parent)
$('#content').unwrap();

// Replace element
$('#old').replaceWith('<div id="new">New content</div>');

// Detach and reinsert later
const item = $('#item').detach();
document.body.appendChild(item.raw);

// Smooth scroll to element
$('#section').scrollTo({ behavior: 'smooth', block: 'center' });
```

### Form Serialization

`serialize()` collects every named, non-disabled control inside the wrapped `<form>` into a plain object — input values, selected option(s), checked checkboxes, radio groups, multi-select arrays, and `<textarea>` content are all supported. `serializeString()` returns the same data already URL-encoded so it can be appended to a query string or sent as `application/x-www-form-urlencoded` body. Both helpers respect the standard form rules: unnamed fields, disabled controls, and `type="submit"` buttons are skipped, and unchecked checkboxes / radios are excluded rather than serialized as `false`.

- `serialize()` – returns form data as object
- `serializeString()` – returns URL-encoded string

```ts
// Get form data as object
const data = $('form').serialize();
// { name: 'John', email: 'john@example.com' }

// Get as query string
const query = $('form').serializeString();
// 'name=John&email=john%40example.com'
```

## BQueryCollection (multi-element wrapper)

`BQueryCollection` is the zero-or-more-element wrapper returned by `$$()` (and by collection-returning methods like `find()`, `siblings()`, `children()`). It behaves like an array of `BQueryElement`s but flattens common operations: writing through the collection iterates every element, while reading returns the value from the first element only — matching jQuery's "first-wins" convention. Use `.each()` / `.map()` / `.toArray()` when you need per-element access, and `.eq(n)` to narrow back down to a single-element collection.

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
- `find(selector)` – query all descendant elements matching a selector across all collection elements (deduplicates shared descendants)

### DOM traversal

- `closest(selector)` – closest matching element, including the element itself when it matches (deduplicated)
- `parent()` – unique parent elements
- `children()` – all child elements across the collection
- `siblings()` – all siblings excluding collection elements
- `next()` – next sibling of each element
- `prev()` – previous sibling of each element

```ts
// Navigate the DOM from a collection
$$('.item').parent().addClass('has-items');
$$('.active').siblings().removeClass('active');
$$('.current').next().addClass('upcoming');
```

```ts
// Find all .item descendants across multiple containers
$$('.container').find('.item').addClass('highlight');
```

### DOM & class helpers

- `addClass(...classNames)`
- `removeClass(...classNames)`
- `toggleClass(className, force?)`
- `attr(name, value?)`
- `removeAttr(name)`
- `toggleAttr(name, force?)`
- `text(value?)`
- `html(value?)` – sanitized by default
- `htmlUnsafe(value)`
- `append(content)`
- `prepend(content)`
- `before(content)`
- `after(content)`
- `wrap(wrapper)`
- `unwrap()`
- `replaceWith(content)`
- `detach()`
- `index()`
- `contents()`
- `offsetParent()`
- `position()`
- `innerWidth()` – content + padding width (first element)
- `innerHeight()` – content + padding height (first element)
- `outerWidth(includeMargin?)` – border-box width (first element)
- `outerHeight(includeMargin?)` – border-box height (first element)
- `css(property)` – getter: returns computed style value (first element)
- `css(property, value)` – setter: sets a single CSS property
- `css(properties)` – setter: sets an object of properties
- `show(display?)`
- `hide()`
- `remove()`
- `empty()`

### Events

- `on(event, handler)`
- `once(event, handler)`
- `off(event, handler)`
- `trigger(event, detail?)`
- `delegate(event, selector, handler)` – event delegation

## Utilities

The core module also exposes a large set of pure, tree-shakeable utility functions — covering objects, functions, strings, numbers, arrays, type guards, and miscellaneous helpers (UID, UUID, polling, retry, …). Two access styles are supported and equivalent:

1. **Named imports** (best for tree-shaking with a bundler): `import { debounce, merge, uid } from '@bquery/bquery/core';`
2. **Namespace import** (best for editor autocomplete and IntelliSense): `import { utils } from '@bquery/bquery/core';` then `utils.debounce(...)`.

Function wrappers (`debounce`, `throttle`, `memoize`, `retry`) return a callable with extra control methods such as `.cancel()`, `.flush()`, and `.clear()` — see each entry below for specifics. None of the utilities mutate their arguments, and deep object helpers (`get`, `set`, `merge`, `defaults`) refuse to traverse prototype keys (`__proto__`, `constructor`, `prototype`), preventing prototype-pollution exploits.

```ts
import { debounce, throttle, merge, uid, utils } from '@bquery/bquery/core';

const id = uid();
const merged = merge({ a: 1 }, { b: 2 });
const delayed = debounce(() => console.log('Saved'), 200);
delayed.cancel(); // Cancel pending invocation

const scrollHandler = throttle(() => console.log('Scroll'), 100);
scrollHandler.cancel(); // Reset throttle, next call executes immediately

const legacyId = utils.uid();
```

`utils` is also explicitly typed as `BQueryUtils`, which makes namespace-style access play nicely with editor IntelliSense when you prefer `utils.debounce(...)` over named imports.

```ts
import { utils, type BQueryUtils } from '@bquery/bquery/core';

const typedUtils: BQueryUtils = utils;
const later = typedUtils.debounce(() => console.log('Saved'), 200);
later.cancel();
```

### Utility list

#### Object
- `clone(value)`
- `merge(...sources)`
- `pick(obj, keys)`
- `omit(obj, keys)`
- `hasOwn(obj, key)`
- `isPlainObject(value)`
- `get(obj, path, default?)` / `set(obj, path, value)` / `has(obj, path)` – prototype-pollution-safe deep accessors (`'a.b.c'` or `'list[0].name'`)
- `mapValues(obj, fn)` / `mapKeys(obj, fn)` / `invert(obj)`
- `deepEqual(a, b)` (alias `isEqual`)
- `freeze(obj)` – deep `Object.freeze`
- `defaults(target, ...sources)` – fill `undefined` keys
- `entriesTyped(obj)` / `keysTyped(obj)` – key-preserving typed wrappers

#### Function
- `debounce(fn, delayMs, options?)` – `DebouncedFn` with `.cancel()`, `.flush()`. Options: `{ leading?, trailing?, maxWait? }`
- `throttle(fn, intervalMs, options?)` – `ThrottledFn` with `.cancel()`, `.flush()`. Options: `{ leading?, trailing? }`
- `once(fn)` / `noop()`
- `memoize(fn, keyFn?)` – `MemoizedFn` with `.clear()`, `.delete(key)`
- `compose(...fns)` / `pipe(...fns)`
- `curry(fn)` / `partial(fn, ...preset)`
- `retry(fn, opts?)` – exponential backoff with jitter and `AbortSignal`

#### Misc
- `uid(prefix?)` – short hash-style id
- `uuid()` – RFC 4122 v4 (uses `crypto.randomUUID()` / `getRandomValues()` when available)
- `isEmpty(value)` / `parseJson(json, fallback)` / `sleep(ms)`
- `tryCatch(fn)` – Go-style `[error, value]` for sync **or** async functions
- `times(n, fn)` / `pollUntil(predicate, opts?)` / `nextFrame()` / `nextTick()`

#### Type guards
- `isElement` / `isCollection` / `isFunction` / `isString` / `isNumber` / `isBoolean` / `isArray` / `isDate` / `isPromise` / `isObject`
- `isError` / `isMap` / `isSet` / `isRegExp` / `isSymbol` / `isBigInt`
- `isAsyncFunction` / `isIterable` / `isAsyncIterable`
- `isNullish(value)` / `isDefined(value)`

#### Number
- `randomInt(min, max)` / `randomFloat(min, max)`
- `clamp(value, min, max)` / `inRange(value, min, max, inclusive?)` / `toNumber(value, fallback?)`
- `round(value, precision?)` / `roundTo(value, step)`
- `lerp(a, b, t)` / `inverseLerp(a, b, value)` / `mapRange(value, inMin, inMax, outMin, outMax)`
- `formatBytes(bytes, opts?)` – decimal/binary, locale-aware via `Intl.NumberFormat`
- `sum(items)` / `average(items)` / `median(items)`
- `degToRad(deg)` / `radToDeg(rad)`

> The locale-aware `formatNumber` is exposed by `@bquery/bquery/i18n`. `utils.formatBytes()` accepts the same `locale` option for consistent localized output without pulling in i18n.

#### String
- `capitalize` / `toKebabCase` / `toCamelCase` / `toSnakeCase` / `toPascalCase` / `toTitleCase`
- `truncate(str, maxLength, suffix?)` / `slugify(str)` / `escapeRegExp(str)`
- `pad(str, length, char?)` / `padStart(str, length, char?)` / `padEnd(str, length, char?)`
- `wordCount(str)` / `lines(str)`
- `template(str, vars)` – safe `${name}` interpolation (no `eval`)
- `stripHtml(str)` – DOM-free tag removal (not a sanitizer; use `sanitizeHtml()` from `@bquery/bquery/security` for untrusted input)
- `randomString(length, charset?)` – crypto-backed when available

#### Array
- `ensureArray(value)` / `unique(items)` / `uniqueBy(items, fn)`
- `chunk(items, size)` / `chunkBy(items, predicate)` / `compact(items)`
- `flatten(items)` / `flattenDeep(items)`
- `groupBy(items, key|fn)` / `keyBy(items, key|fn)`
- `partition(items, pred)` / `zip(...arrays)`
- `range(start, end, step?)`
- `first(items)` / `last(items)` / `take(items, n)` / `drop(items, n)`
- `sample(items)` / `shuffle(items)` (Fisher–Yates)
- `sortBy(items, fn|fns)`
- `intersection(a, b)` / `difference(a, b)`
- `move(items, from, to)`

<!-- uniform-template-footer -->

## Pitfalls and gotchas

- `$(selector)` **throws** if no element matches — use `$$(selector)` (collection, never throws) for optional queries.
- Mutating wrappers return `this` for chaining; non-mutating getters (`.text()`, `.attr()` without args) do not.
- `.text()` / `.attr()` / `.css()` are overloaded as getter and setter — pass a value to mutate.
- HTML-writing APIs (`.html(value)`) sanitize untrusted content by default; use `.raw.innerHTML` only for trusted strings.
- Utility helpers like `deepEqual`, `cloneDeep`, and `freeze` operate by structure — symbols and non-enumerable props are intentionally skipped.

## Performance notes

- Cache wrappers when re-using them in tight loops — each `$()` call performs a `querySelector`.
- Prefer `.find()` / `.children()` over re-querying from `document` to keep selector scope narrow.
- For very large lists, use `chunkBy()` / `range()` from `core/utils` to stream work rather than materializing arrays.

## Testing this module

- DOM tests use `happy-dom` via `tests/setup.ts`. Inline DOM creation, assertion, then `.remove()` is the preferred pattern (see `tests/core.test.ts`).
- Utility helpers are pure functions — assert with `bun:test`'s `expect`.

## Related modules

- [Reactive](./reactive) — combine signals with DOM updates.
- [View](./view) — declarative bindings on top of the core wrappers.
- [Security](./security) — sanitizer used by `.html()` and related APIs.

## Version history

- **1.13.0** — major `core/utils` expansion (array / function / object / string / number / misc helpers, additional type guards).
- **1.0.0** — original chainable jQuery-inspired wrappers shipped.
