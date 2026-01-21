# Security

bQuery sanitizes DOM writes by default and supports Trusted Types.

```ts
import { sanitize } from 'bquery/security';

const safeHtml = sanitize(userInput);
```
