import { SSESink, SSESource } from './mod.ts';
import { assert, assertEquals } from 'jsr:@std/assert';

Deno.test('[SSE] Simple events streaming', async () => {
  const sink = new SSESink();
  const source = new SSESource('http://127.0.0.1/sse', { fetch: async () => sink.getResponse() });

  setTimeout(() => {
    sink.sendMessage({ data: 'Test' });
    sink.sendMessage({ data: 'Test2' });
    sink.close();
  }, 1);

  let counter = 0;
  for await (const _event of source) {
    counter++;
  }
  assertEquals(counter, 2);
});

Deno.test('[SSE] Full events sending', async () => {
  const sink = new SSESink();
  const source = new SSESource('http://127.0.0.1/sse', { fetch: async () => sink.getResponse() });

  setTimeout(() => {
    sink.sendMessage({ data: 'Test', event: 'hello', id: '1', retry: 2, comment: 'comment' });
    sink.sendMessage({ data: 'Test2', event: 'hello2', id: '2', retry: 3, comment: 'comment2' });
    sink.close();
  }, 1);

  const { event: ev1 } = await source.next();
  assert(ev1);
  assertEquals(ev1.data, 'Test');
  assertEquals(ev1.event, 'hello');
  assertEquals(ev1.id, '1');
  assertEquals(ev1.retry, 2);
  const { event: ev2, done } = await source.next();
  assert(ev2);
  assertEquals(ev2.data, 'Test2');
  assertEquals(ev2.event, 'hello2');
  assertEquals(ev2.id, '2');
  assertEquals(ev2.retry, 3);
  assertEquals(done, false);
  const { done: done2 } = await source.next();
  assertEquals(done2, true);
});

Deno.test('[SSE] SSESource should sent headers', async () => {
  const requestInit = new Request('http://127.0.0.1/sse', {
    headers: {
      'Authorization': 'Bearer token',
      'X-Custom': 'custom',
      'Content-Type': 'application/json',
    },
  });
  const source = new SSESource(requestInit, {
    fetch: async (req: Request) => {
      assertEquals(req.headers.get('Authorization'), 'Bearer token');
      assertEquals(req.headers.get('X-Custom'), 'custom');
      assertEquals(req.headers.get('Content-Type'), 'application/json');
      assertEquals(req.headers.get('Accept'), 'text/event-stream');
      return Response.error();
    },
  });
  try {
    await source.next();
  } catch {
    return Promise.resolve();
  }
  return Promise.reject('Should have thrown');
});

Deno.test('[SSE] Making it easier to test', async () => {
  const sink = new SSESink();
  const requestInit = new Request('http://127.0.0.1/sse');
  const source = new SSESource(requestInit, { fetch: async () => sink.getResponse() });
  sink.sendMessage({ data: 'Test' });
  const { event, done } = await source.next();
  assert(event);
  assertEquals(done, false);
  assertEquals(event.data, 'Test');
  sink.close();
  const { event: ev2, done: d2 } = await source.next();
  assert(!ev2);
  assertEquals(d2, true);
});

Deno.test('[SSE] Gracefull closing by sink', async () => {
  const sink = new SSESink();
  const requestInit = new Request('http://127.0.0.1/sse');
  const source = new SSESource(requestInit, { fetch: async () => sink.getResponse() });
  sink.close();
  const { done } = await source.next();
  assertEquals(done, true);
});

Deno.test('[SSE] Gracefull closing by source', async () => {
  const sink = new SSESink();
  const srv = Deno.serve({ port: 0, onListen: () => {} }, () => sink.getResponse());
  const requestInit = new Request(`http://127.0.0.1:${srv.addr.port}/sse`);
  const source = new SSESource(requestInit);
  const closed = new Promise<void>((resolve) => sink.addEventListener('close', () => resolve()));
  await source.connected;
  await source.close();
  await closed;
  await srv.shutdown();
});

Deno.test('[SSE] Gracefull closing by source before connection', async () => {
  const requestInit = new Request(`http://127.0.0.1/sse`);
  const source = new SSESource(requestInit, {
    fetch: () => {
      throw new Error('Should not fetch');
    },
  });
  await source.close();
});

Deno.test('[SSE] SSESource fail when status is not 200', async () => {
  const requestInit = new Request('http://127.0.0.1/sse');
  const source = new SSESource(requestInit, {
    fetch: async () => {
      return new Response(JSON.stringify({}), { status: 400 });
    },
  });
  const error = await source.next().then(() => null).catch((e) => e);
  await source.close();
  assert(error);
  assertEquals(error.message, 'Unexpected status code: 400');
});

Deno.test('[SSE] should fail if content-type is not text/event-stream', async () => {
  const requestInit = new Request('http://127.0.0.1/sse');
  const source = new SSESource(requestInit, {
    fetch: async () => {
      return new Response('', {
        headers: {
          'content-type': 'application/json',
        },
      });
    },
  });
  const error = await source.next().then(() => null).catch((e) => e);
  await source.close();
  assert(error);
  assertEquals(error.message, 'Unexpected content type: application/json');
});
