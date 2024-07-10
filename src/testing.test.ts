import { Next, Planigale, Req, Res, Router } from './mod.ts';
import assert from 'node:assert';
import { TestingSrv, TestingQuick } from './testing.ts';

[
	//TestingSrv,
	TestingQuick
].forEach((Testing) => {
	/*
	Deno.test(`[${Testing.name}] EventSource`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen, EventSource} = new Testing(app);
		try {
			// Setup
			app.route({
				method: 'GET',
				url: '/sse',
				schema: {},
				handler: (_req: Req, res: Res) => {
					res.status = 400;
					res.send({ ok: false });
				},
			});
			await listen();

			// Test 
			return new Promise((resolve, reject) => {
				const source = new EventSource(`${getUrl()}/sse`);
				source.onerror = (e) => {
					//assertdeepEqual(source., 'error');
					resolve();
				};
				source.onmessage = (e) => {
					reject(new Error('Should not receive message'));
				};
				source.onopen = () => {
					reject(new Error('Should not open'));
				};
			});
		} finally {
			// Teardown
			close();
		}
	})
	*/
	Deno.test(`[${Testing.name}] Server sent events stream`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen, EventSource} = new Testing(app);
		try {
			// Setup
			app.route({
				method: 'GET',
				url: '/sse',
				schema: {},
				handler: (_req: Req, res: Res) => {
					const target = res.sendEvents();
					setTimeout(() => {
						target.sendMessage({data: "Test" });
						target.close();
					}, 1);
				},
			});
			await listen();

			// Test
			const req = new Request(`${getUrl()}/sse`);
			console.log(req);
			const res = await fetch(req);
			console.log('res', res);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(res.headers.get('content-type'), 'text/event-stream');
			// Test 
			return new Promise((resolve, reject) => {
				const source = new EventSource(`${getUrl()}/sse`);
				source.addEventListener('message', (m) => {
					console.log('message', m);
				});
				source.addEventListener('error', (e) => {
					console.log('error', e);
					source.close();
					resolve();
				});
			});
		} finally {
			close();
		}
	});
	/*
	Deno.test(`[${Testing.name}] EventSource happy path`, async () => {
		const app = new Planigale();
		const {getUrl, close, listen, EventSource} = new Testing(app);
		try {
			// Setup
			app.route({
				method: 'GET',
				url: '/sse',
				handler: (_req: Req, res: Res) => {
					const target = res.sendEvents();
					setTimeout(() => target.sendMessage({event: 'hello'}), 1);
					setTimeout(() => target.sendMessage({event: 'hello2'}), 2);
					setTimeout(() => target.close(), 3);
				},
			});
			await listen();

			// Test 
			return new Promise((resolve, reject) => {
				const source = new EventSource(`${getUrl()}/sse`);
				source.addEventListener('message', (m) => {
					console.log('message', m);
				});
				source.addEventListener('error', (e) => {
					console.log('error', e);
					source.close();
					resolve();
				});
			});
		} finally {
			// Teardown
			close();
		}
	})
	*/
});

