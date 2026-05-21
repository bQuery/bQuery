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
- `removeAttr(name)`
- `toggleAttr(name, force?)`
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

- `css(property)` – getter: returns computed style value via `getComputedStyle()`
- `css(property, value)` – setter: sets a single CSS property
- `css(properties)` – setter: sets multiple CSS properties from an object
- `show(display?)`
- `hide()`
- `toggle(force?)`

### Events (Element)

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
