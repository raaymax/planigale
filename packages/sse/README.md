# SSESource

This library contains class that is used to create a server-sent event source. It is similar in use to the `EventSource` class in JavaScript but the main difference it that it's constructor takse arguments just like `fetch` does. This allows you to pass headers, cookies, etc. to the server when creating the event source.

> [!WARNING]
> Methods `onopen`, `onmessage`, `onerror` are not supported yet. Use `addEventListener` instead.

## Usage

```typescript
import { SSESource } from 'jsr:@codecat/sse';

const source = new SSESource('https://example.com/sse', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
  },
  body: JSON.stringify({ key: 'value' }),
});

source.addEventListener('open', (event) => {
  console.log('Connection opened');
});

source.addEventListener('message', (event) => {
  console.log(event.data);
});

source.addEventListener('error', (event) => {
  console.error(event);
});
```

## License

MIT License

Copyright (c) 2024 Mateusz Russak
