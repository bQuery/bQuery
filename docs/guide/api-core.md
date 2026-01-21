# Core API

The core module contains selectors, DOM manipulation, events, and utilities. The API mirrors the ergonomics of jQuery while remaining explicit and debuggable.

## Selectors

```ts
import { $, $$ } from 'bquery/core';

const button = $('#submit');
const items = $$('.list-item');
```

## DOM operations

```ts
$('#box').addClass('active').css({ opacity: '0.7' }).attr('data-state', 'ready');
```

## Events

```ts
$('#save').on('click', (event) => {
  console.log('Saved', event.type);
});
```

## Utilities

```ts
import { utils } from 'bquery/core';

const id = utils.uid();
const merged = utils.merge({ a: 1 }, { b: 2 });
```
