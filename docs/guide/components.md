# Components

Components are lightweight Web Components with typed props and a render function.

```ts
import { component, html } from 'bquery/component';

component('user-card', {
  props: {
    username: { type: String, required: true },
  },
  render({ props }) {
    return html`<div>Hello ${props.username}</div>`;
  },
});
```
