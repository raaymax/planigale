import { Next, Planigale, Req, Res, Router } from './mod.ts';
import assert from 'node:assert';

const assertEquals = (value1: unknown, value2: unknown) => {
  assert.deepEqual(value1, value2);
};

Deno.test('Basic functions', async () => {
  const app = new Planigale();
  app.route({
    method: 'GET',
    url: '/users/:id',
    schema: {},
    handler: (req: Req, res: Res) => {
      assertEquals(req.params.id, 'oko');
      assertEquals(req.query.sad, '123');
      assertEquals(req.query.zxc, '432');
      assertEquals(req.url, 'http://localhost/users/oko?sad=123&zxc=432');
      assertEquals(req.method, 'GET');
      assertEquals(req.path, '/users/oko');
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/users/oko?sad=123&zxc=432', {
    method: 'GET',
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('content-type'), 'application/json');
  assertEquals(await res.json(), { ok: true });
});

Deno.test('Reading and setting cookies', async () => {
  const app = new Planigale();
  app.route({
    method: 'GET',
    url: '/users',
    schema: {},
    handler: (req: Req, res: Res) => {
			assertEquals(req.cookies.get('auth'), 'token');
			res.cookies.set('test', 'value', { maxAge: 1000 });
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/users', {
    method: 'GET',
		headers: {
			cookie: 'auth=token',
		}
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
	assertEquals(res.headers.get('set-cookie'), 'test=value; Max-Age=1000');
  assertEquals(res.headers.get('content-type'), 'application/json');
  assertEquals(await res.json(), { ok: true });
});

Deno.test('Body validation', async () => {
  const app = new Planigale();
  app.route({
    method: 'POST',
    url: '/body',
    schema: {
      body: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { type: 'string' },
        },
      },
    },
    handler: async (req: Req, res: Res) => {
      assertEquals(req.body.data, 'oko');
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/body', {
    method: 'POST',
    body: JSON.stringify({ data: 'oko' }),
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
});

Deno.test('Body validation failed', async () => {
  const app = new Planigale();
  app.route({
    method: 'POST',
    url: '/body',
    schema: {
      body: {
        type: 'object',
        required: ['data', 'asd'],
        properties: {
          data: { type: 'string' },
          asd: { type: 'number' },
        },
      } as const,
    },
    handler: async (_req: Req, _res) => {
      throw new Error('Should not be called');
    },
  });
  const req = new Request('http://localhost/body', {
    method: 'POST',
    body: JSON.stringify({ other: 'oko', asd: 'zxc' }),
  });
  const res = await app.handle(req);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), {
    errorCode: 'VALIDATION_ERROR',
    message: 'Validation failed',
    errors: [
      {
        block: 'body',
        instancePath: '',
        keyword: 'required',
        message: "must have required property 'data'",
        params: {
          missingProperty: 'data',
        },
        schemaPath: '#/required',
      },
      {
        block: 'body',
        instancePath: '/asd',
        keyword: 'type',
        message: 'must be number',
        params: {
          type: 'number',
        },
        schemaPath: '#/properties/asd/type',
      },
    ],
  });
});

Deno.test('Validation error aggregation', async () => {
  const app = new Planigale();
  app.route({
    method: 'POST',
    url: '/validation/:id',
    schema: {
      body: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { type: 'string' },
        },
      },
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number' },
        },
      },
      headers: {
        type: 'object',
        required: ['authorization'],
        properties: {
          authorization: {
            type: 'string',
            pattern: '[Bb]earer .*',
          },
        },
      },
      query: {
        type: 'object',
        required: ['asd'],
        properties: {
          asd: { type: 'number' },
        },
      },
    },
    handler: async (_req: Req, _res) => {
      throw new Error('Should not be called');
    },
  });
  const req = new Request('http://localhost/validation/asd?asd=test', {
    method: 'POST',
    body: JSON.stringify({ other: 'oko' }),
    headers: {
      authorization: 'token',
    },
  });
  const res = await app.handle(req);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), {
    errorCode: 'VALIDATION_ERROR',
    message: 'Validation failed',
    errors: [
      {
        block: 'body',
        instancePath: '',
        keyword: 'required',
        message: "must have required property 'data'",
        params: {
          missingProperty: 'data',
        },
        schemaPath: '#/required',
      },
      {
        block: 'params',
        instancePath: '/id',
        keyword: 'type',
        message: 'must be number',
        params: {
          type: 'number',
        },
        schemaPath: '#/properties/id/type',
      },
      {
        block: 'query',
        instancePath: '/asd',
        keyword: 'type',
        message: 'must be number',
        params: {
          type: 'number',
        },
        schemaPath: '#/properties/asd/type',
      },
      {
        block: 'headers',
        instancePath: '/authorization',
        keyword: 'pattern',
        message: 'must match pattern "[Bb]earer .*"',
        params: {
          pattern: '[Bb]earer .*',
        },
        schemaPath: '#/properties/authorization/pattern',
      },
    ],
  });
});

Deno.test('Middlewares', async () => {
  const app = new Planigale();
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
  const req = new Request('http://localhost/users/oko?sad=123&zxc=432', {
    method: 'GET',
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: 'middleware' });
  assertEquals(res.headers.get('x-middleware'), 'true');
});

Deno.test('Routers', async () => {
  const app = new Planigale();
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
      assertEquals(req.state.app, true);
      assertEquals(req.state.router, true);
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/users/1', {
    method: 'GET',
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
});

Deno.test('Routers with different middlewares', async () => {
  const app = new Planigale();
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
      assertEquals(req.state.app, true);
      assertEquals(req.state.router, true);
      res.send({ ok: true });
    },
  });
  app.route({
    method: 'GET',
    url: '/ping',
    schema: {},
    handler: async (req: Req, res: Res) => {
      assertEquals(req.state.app, true);
      assertEquals(!req.state.router, true);
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/ping', {
    method: 'GET',
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
});

Deno.test('Parse params from mount point', async () => {
  const app = new Planigale();
  const router = new Router();
  app.use('/users/:userId', router);
  router.route({
    method: 'GET',
    url: '/details',
    schema: {},
    handler: async (req: Req, res: Res) => {
      assertEquals(req.params.userId, 'test');
      res.send({ ok: true });
    },
  });
  const req = new Request('http://localhost/users/test/details', {
    method: 'GET',
  });
  const res = await app.handle(req);
  assertEquals(res.status, 200);
});
