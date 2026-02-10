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
- `focus()` / `blur()`
- `raw` (getter) / `node` (getter)

### DOM Manipulation

- `wrap(wrapper)` – wrap element with new parent (accepts tag name or Element)
- `unwrap()` – remove parent, keeping element
- `replaceWith(content)` – replace element with new content
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

### Utility list

- `clone(value)`
- `merge(...sources)`
- `pick(obj, keys)`
- `omit(obj, keys)`
- `hasOwn(obj, key)`
- `debounce(fn, delayMs)` – returns `DebouncedFn` with `.cancel()` method
- `throttle(fn, intervalMs)` – returns `ThrottledFn` with `.cancel()` method
- `once(fn)`
- `noop()`
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
- `isDate(value)`
- `isPromise(value)`
- `isObject(value)`
- `parseJson(json, fallback)`
- `sleep(ms)`
- `randomInt(min, max)`
- `clamp(value, min, max)`
- `inRange(value, min, max, inclusive?)`
- `toNumber(value, fallback?)`
- `capitalize(str)`
- `toKebabCase(str)`
- `toCamelCase(str)`
- `truncate(str, maxLength, suffix?)`
- `slugify(str)`
- `escapeRegExp(str)`
- `ensureArray(value)`
- `unique(items)`
- `chunk(items, size)`
- `compact(items)`
- `flatten(items)`
