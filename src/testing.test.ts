import { Planigale, Req, Res} from './mod.ts';
import assert from 'node:assert';
import { TestingSrv, TestingQuick } from './testing.ts';
import { SSESource } from '@codecat/sse-source';

[
	TestingSrv,
	TestingQuick
].forEach((Testing) => {
	Deno.test(`[${Testing.name}] SSESource`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
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
			return await new Promise((resolve, reject) => {
				const source = new SSESource(`${getUrl()}/sse`, {fetch});
				source.addEventListener('error', (e) => {
					//assertdeepEqual(source., 'error');
					source.close();
					resolve();
				});
				source.addEventListener('message', (m) => {
					reject(new Error('Should not receive message'));
				});
				source.addEventListener('open', (m) => {
					reject(new Error('Should not open'));
				});
			});
		} finally {
			// Teardown
			close();
		}
	})

	Deno.test(`[${Testing.name}] Server sent events stream`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
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
			return await new Promise((resolve, reject) => {
				const source = new SSESource(`${getUrl()}/sse`, {fetch});
				let message = '';
				source.addEventListener('message', (m) => {
					//console.log('message', m);
					message = (m as any).data;
				});
				source.addEventListener('error', (e) => {
					//console.log('error', e);
					assert.deepEqual(message, 'Test');
					source.close();
					resolve();
				});
			});
		} finally {
			close();
		}
	});

	Deno.test(`[${Testing.name}] SSESource happy path`, async () => {
		const app = new Planigale();
		const {getUrl, close, listen, fetch} = new Testing(app);
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
			return await new Promise((resolve, reject) => {
				const source = new SSESource(`${getUrl()}/sse`, {fetch});
				source.addEventListener('message', (m) => {
					console.log('message', m);
				});
				source.addEventListener('error', (e) => {
					//console.log('error', e);
					source.close();
					resolve();
				});
			});
		} finally {
			// Teardown
			close();
		}
	})
});

