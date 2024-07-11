import { SSESink, SSESource } from './mod.ts';
import assert from 'node:assert';

Deno.test('SSESource and SSESink', async () => {
  const sink = new SSESink();
  const source = new SSESource('http://127.0.0.1/sse', { fetch: async () => sink.getReponse() });
  return await new Promise<void>((resolve) => {
    let counter = 0;
    source.addEventListener('message', () => {
      counter++;
    });
    source.addEventListener('error', () => {
      assert.equal(counter, 2);
      console.log('resolved');
      source.close();
      resolve();
    });
    sink.sendMessage({ data: 'Test' });
    sink.sendMessage({ data: 'Test2' });
    sink.close();
  });
});


Deno.test('SSESource should sent headers', async () => {
	const requestInit = new Request('http://localhost/sse', {
		headers: {
			'Authorization': 'Bearer token',
			'X-Custom': 'custom',
			'Content-Type': 'application/json',
		},
	});
	let fetchRequest: Request | null = null;
	await new Promise<void>((resolve) => {
		const source = new SSESource(requestInit, { 
			fetch: async (req: Request) => {
				fetchRequest = req;
				return Response.error();
			}
		});
		source.addEventListener('error', () => {
			source.close();
			resolve();
		});
	});
	if(fetchRequest === null) throw new Error('Request not sent');
	let req: Request = fetchRequest;
	assert.equal(req.headers.get('Authorization'), 'Bearer token');
	assert.equal(req.headers.get('X-Custom'), 'custom');
	assert.equal(req.headers.get('Content-Type'), 'application/json');
	assert.equal(req.headers.get('Accept'), 'text/event-stream');
})

