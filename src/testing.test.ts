import { Next, Planigale, Req, Res, Router } from './mod.ts';
import assert from 'node:assert';
import { TestingSrv, TestingQuick } from './testing.ts';

[
	TestingSrv,
	TestingQuick
].forEach((Testing) => {
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
				const source = new EventSource(`${getUrl()}/users/oko?sad=123&zxc=432`);
				source.onerror = (e) => {
					//assert.deepEqual(source., 'error');
					assert.deepEqual(e.status, 400);
					assert.deepEqual(e.message, 'Bad Request');
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
});

