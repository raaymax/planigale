import { Next, Planigale, Req, Res, Router } from './mod.ts';
import assert from 'node:assert';
import { TestingSrv, TestingQuick } from './testing.ts';

[
	TestingSrv,
	TestingQuick
].forEach((Testing) => {
	Deno.test(`[${Testing.name}] Basic functions`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
		try {
			// Setup
			app.route({
				method: 'GET',
				url: '/users/:id',
				schema: {},
				handler: (req: Req, res: Res) => {
					assert.deepEqual(req.params.id, 'oko');
					assert.deepEqual(req.query.sad, '123');
					assert.deepEqual(req.query.zxc, '432');
					assert.deepEqual(req.url, `${getUrl()}/users/oko?sad=123&zxc=432`);
					assert.deepEqual(req.method, 'GET');
					assert.deepEqual(req.path, '/users/oko');
					res.send({ ok: true });
				},
			});
			await listen();

			// Test 
			const req = new Request(`${getUrl()}/users/oko?sad=123&zxc=432`);
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(res.headers.get('content-type'), 'application/json');
			assert.deepEqual(await res.json(), { ok: true });
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
			const req = new Request(`${getUrl()}/sse`);
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(res.headers.get('content-type'), 'text/event-stream');
			const reader = res.body?.getReader();
			await reader?.read().then(({ value }) => {
				const text = new TextDecoder().decode(value);
				const m = text.match(/data:(.*)/);
				assert.deepEqual(m?.[1], 'Test');
				reader.cancel();
			});
		} finally {
			close();
		}
	});

	Deno.test(`[${Testing.name}] Middlewares`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
		try {
			// Setup
			app.use(async (req: Req, res: Res, next: Next) => {
				req.state.data = 'middleware';
				await next();
				res.headers.set('x-middleware', 'true');
			});
			app.route({
				method: 'GET',
				url: '/users/:id',
				schema: {},
				handler: async (req: Req, res: Res) => {
					res.send({ ok: req.state.data });
				},
			});
			await listen();
	
			// Test
			const req = new Request(`${getUrl()}/users/oko?sad=123&zxc=432`, {
				method: 'GET',
			});
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(await res.json(), { ok: 'middleware' });
			assert.deepEqual(res.headers.get('x-middleware'), 'true');
		} finally {
			// Teardown
			close();
		}
	});

	Deno.test(`[${Testing.name}] Routers`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
		try {
			// Setup
			const router = new Router();
			app.use('/users', router);
			app.use(async (req: Req, _res: Res, next: Next) => {
				req.state.app = true;
				await next();
			});
			router.use(async (req: Req, _res: Res, next: Next) => {
				req.state.router = true;
				await next();
			});
			router.route({
				method: 'GET',
				url: '/:id',
				schema: {},
				handler: async (req: Req, res: Res) => {
					assert.deepEqual(req.state.app, true);
					assert.deepEqual(req.state.router, true);
					res.send({ ok: true });
				},
			});
			await listen();

			// Test
			const req = new Request(`${getUrl()}/users/1`, {
				method: 'GET',
			});
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(await res.json(), { ok: true });
		} finally {
			// Teardown
			close();
		}
	});

	Deno.test(`[${Testing.name}] Routers with different middlewares`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
		try {
			// Setup
			const router = new Router();
			app.use('/users', router);
			app.use(async (req: Req, _res: Res, next: Next) => {
				req.state.app = true;
				await next();
			});
			router.use(async (req: Req, _res: Res, next: Next) => {
				req.state.router = true;
				await next();
			});
			router.route({
				method: 'GET',
				url: '/:id',
				schema: {},
				handler: async (req: Req, res: Res) => {
					assert.deepEqual(req.state.app, true);
					assert.deepEqual(req.state.router, true);
					res.send({ ok: true });
				},
			});
			app.route({
				method: 'GET',
				url: '/ping',
				schema: {},
				handler: async (req: Req, res: Res) => {
					assert.deepEqual(req.state.app, true);
					assert.deepEqual(!req.state.router, true);
					res.send({ ok: true });
				},
			});
			await listen();

			// Test
			const req = new Request(`${getUrl()}/ping`, {
				method: 'GET',
			});
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(await res.json(), { ok: true });
		} finally {
			// Teardown
			close();
		}
	});

	Deno.test(`[${Testing.name}] Parse params from mount point`, async () => {
		const app = new Planigale();
		const {getUrl, fetch, close, listen} = new Testing(app);
		try {
			// Setup
			const router = new Router();
			app.use('/users/:userId', router);
			router.route({
				method: 'GET',
				url: '/details',
				schema: {},
				handler: async (req: Req, res: Res) => {
					assert.deepEqual(req.params.userId, 'test');
					res.send({ ok: true });
				},
			});
			await listen();
			
			// Test
			const req = new Request(`${getUrl()}/users/test/details`, {
				method: 'GET',
			});
			const res = await fetch(req);
			assert.deepEqual(res.status, 200);
			assert.deepEqual(await res.json(), { ok: true });
		} finally {
			// Teardown
			close();
		}
	});
});

