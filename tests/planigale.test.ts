import { Next, Planigale, Req, Res, Router, ApiError } from '@planigale/planigale';
import { SSESink } from '@planigale/sse';
import { TestingQuick, TestingSrv } from '@planigale/testing';
import { assert, assertEquals } from './deps_test.ts';

[
  TestingSrv,
  TestingQuick,
].forEach((Testing) => {
  Deno.test(`[${Testing.name}] 404 not found`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      await listen();

      // Test
      const req = new Request(`${getUrl()}/any-url`);
      const res = await fetch(req);
      assertEquals(res.status, 404);
      assertEquals(res.headers.get('content-type'), 'application/json');
      assertEquals(await res.json(), {
        errorCode: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      });
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] 500 internal server error`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      app.route({
        method: 'GET',
        url: '/error',
        schema: {},
        handler: async () => {
          throw new Error('Test Error');
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/error`);
      const res = await fetch(req);
      assertEquals(res.status, 500);
      assertEquals(res.headers.get('content-type'), 'application/json');
      const json = await res.json();
      assertEquals(json.errorCode, 'INTERNAL_SERVER_ERROR');
      assertEquals(json.message, 'Test Error');
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Setting cookies and headers using Res object`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      app.route({
        method: 'GET',
        url: '/error',
        schema: {},
        handler: async () => {
          const res = new Res();
          res.cookies.set('test', 'value');
          res.headers.set('x-test', 'value');
          res.send({ok: true});
          return res;
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/error`);
      const res = await fetch(req);
      const json = await res.json();
      assertEquals(json.ok, true);
      assertEquals(res.headers.get('x-test'), 'value');
      assertEquals(res.headers.get('set-cookie'), 'test=value');
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Custom api error server error`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    class AuthError extends ApiError {
      constructor(message: string) {
        super(401, 'AUTH_FAILED', message);
        this.log = true;
      }
    }
    try {
      // Setup
      app.route({
        method: 'GET',
        url: '/error',
        schema: {},
        handler: async () => {
          throw new AuthError('failed auth');
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/error`);
      const res = await fetch(req);
      assertEquals(res.status, 401);
      assertEquals(res.headers.get('content-type'), 'application/json');
      const json = await res.json();
      assertEquals(json.errorCode, 'AUTH_FAILED');
      assertEquals(json.message, 'failed auth');
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Basic functions`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      app.route({
        method: 'GET',
        url: '/users/:id',
        schema: {},
        handler: (req: Req) => {
          assertEquals(req.params.id, 'oko');
          assertEquals(req.query.sad, '123');
          assertEquals(req.query.zxc, '432');
          assertEquals(req.url, `${getUrl()}/users/oko?sad=123&zxc=432`);
          assertEquals(req.method, 'GET');
          assertEquals(req.path, '/users/oko');
          return Response.json({ ok: true });
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/users/oko?sad=123&zxc=432`);
      const res = await fetch(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get('content-type'), 'application/json');
      assertEquals(await res.json(), { ok: true });
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Server sent events stream`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      app.route({
        method: 'GET',
        url: '/sse',
        schema: {},
        handler: (_req: Req) => {
          const target = new SSESink();
          setTimeout(() => {
            target.sendMessage({ data: 'Test' });
            target.close();
          }, 1);
          return target;
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/sse`);
      const res = await fetch(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get('content-type'), 'text/event-stream');
      const reader = res.body?.getReader();
      await reader?.read().then(({ value }) => {
        const text = new TextDecoder().decode(value);
        const m = text.match(/data:(.*)/);
        assertEquals(m?.[1], 'Test');
        reader.cancel();
      });
    } finally {
      close();
    }
  });

  Deno.test(`[${Testing.name}] Middlewares`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      app.use(async (req: Req, next: Next) => {
        req.state.data = 'middleware';
        const res = await Res.makeResponse(await next());
        res.headers.set('x-middleware', 'true');
        return res;
      });
      app.route({
        method: 'GET',
        url: '/users/:id',
        schema: {},
        handler: async (req: Req) => {
          return Response.json({ ok: req.state.data });
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/users/oko?sad=123&zxc=432`, {
        method: 'GET',
      });
      const res = await fetch(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: 'middleware' });
      assertEquals(res.headers.get('x-middleware'), 'true');
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Routers`, async () => {
    const app = new Planigale();
    let order = '';
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      const router = new Router();
      app.use('/users', router);
      app.use(async (_req: Req, next: Next) => {
        order += 'a';
        return await next();
      });
      app.use(async (_req: Req, next: Next) => {
        order += 'b';
        return await next();
      });
      router.use(async (_req: Req, next: Next) => {
        order += 'c';
        return await next();
      });
      router.use(async (_req: Req, next: Next) => {
        order += 'd';
        return await next();
      });
      router.route({
        method: 'GET',
        url: '/:id',
        schema: {},
        handler: async (_req: Req) => {
          order += 'e';
          return Response.json({ ok: true });
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/users/1`, {
        method: 'GET',
      });
      order += '0';
      const res = await fetch(req);
      assertEquals(order, '0abcde');
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Routers with different middlewares`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      const router = new Router();
      app.use('/users', router);
      app.use(router);
      app.use(async (req: Req, next: Next) => {
        req.state.app = true;
        return await next();
      });
      router.use(async (req: Req, next: Next) => {
        req.state.router = true;
        return await next();
      });
      router.route({
        method: 'GET',
        url: '/:id',
        schema: {},
        handler: async (req: Req) => {
          assertEquals(req.state.app, true);
          assertEquals(req.state.router, true);
          return Response.json({ ok: true });
        },
      });
      app.route({
        method: 'GET',
        url: '/ping',
        schema: {},
        handler: async (req: Req) => {
          assertEquals(req.state.app, true);
          assertEquals(!req.state.router, true);
          return Response.json({ ok: true });
        },
      });
      await listen();

      // Test
      {
        const req = new Request(`${getUrl()}/ping`, {
          method: 'GET',
        });
        const res = await fetch(req);
        assertEquals(res.status, 200);
        assertEquals(await res.json(), { ok: true });
      }
      {
        const res = await fetch(
          new Request(`${getUrl()}/someId`, {
            method: 'GET',
          }),
        );
        assertEquals(res.status, 200);
        assertEquals(await res.json(), { ok: true });
      }
      {
        const res = await fetch(
          new Request(`${getUrl()}/users/someId`, {
            method: 'GET',
          }),
        );
        assertEquals(res.status, 200);
        assertEquals(await res.json(), { ok: true });
      }
      {
        const res = await fetch(
          new Request(`${getUrl()}/unknown/path`, {
            method: 'GET',
          }),
        );
        assertEquals(res.status, 404);
        const json = await res.json();
        assertEquals(json.errorCode, 'RESOURCE_NOT_FOUND');
      }
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Parse params from mount point`, async () => {
    const app = new Planigale();
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
      const router = new Router();
      app.use('/users/:userId', router);
      router.route({
        method: 'GET',
        url: '/details',
        schema: {},
        handler: async (req: Req) => {
          assertEquals(req.params.userId, 'test');
          return Response.json({ ok: true });
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/users/test/details`, {
        method: 'GET',
      });
      const res = await fetch(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    } finally {
      // Teardown
      close();
    }
  });
  Deno.test(`[${Testing.name}] onClose gentle shutdown`, async () => {
    const app = new Planigale();
    const { close, listen } = new Testing(app);
    // Setup
    await listen();
    // Test
    const closed = await new Promise<boolean>((resolve) => {
      app.onClose(() => {
        resolve(true);
      });
      close();
    });
    assert(closed);
  });
});

Deno.test({
  name: `[Serve] Server starting with default port`,
  ignore: Deno.env.get('CI') !== 'true',
  fn: async () => {
    const app = new Planigale();
    // Setup
    app.route({
      method: 'GET',
      url: '/ping',
      schema: {},
      handler: async () => {
        return Response.json({ ok: true });
      },
    });
    const srv = await app.serve();
    try {
      assertEquals(srv.addr.port, 8000);
      const baseUrl = `http://${srv.addr.hostname}:${srv.addr.port}`;
      const req = new Request(`${baseUrl}/ping`);
      const res = await fetch(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get('content-type'), 'application/json');
      assertEquals(await res.json(), { ok: true });
    } catch (e) {
      throw e;
    } finally {
      srv.shutdown();
    }
  },
});

Deno.test({
  name: `Strict mode url matching`,
  fn: async (t) => {
    const app = new Planigale({strict: true});
    // Setup
    app.route({
      method: 'GET',
      url: '/test',
      schema: {},
      handler: async () => {
        return Response.json({ ok: true });
      },
    });

    app.route({
      method: 'GET',
      url: '/trailing/',
      schema: {},
      handler: async () => {
        return Response.json({ ok: true });
      },
    });

    await t.step('/test should match url without trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/test`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });

    await t.step('/test should not match url with trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/test/`);
      const res = await app.handle(req);
      assertEquals(res.status, 404);
      await res.body?.cancel();
    });

    await t.step('/trailing/ should not match url without trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/trailing`);
      const res = await app.handle(req);
      assertEquals(res.status, 404);
      await res.body?.cancel();
    });

    await t.step('/trailing/ should match url with trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/trailing/`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });
  },
});

Deno.test({
  name: `non-Strict mode url matching (default)`,
  fn: async (t) => {
    const app = new Planigale({strict: false});
    // Setup
    app.route({
      method: 'GET',
      url: '/test',
      schema: {},
      handler: async () => {
        return Response.json({ ok: true });
      },
    });

    app.route({
      method: 'GET',
      url: '/trailing/',
      schema: {},
      handler: async () => {
        return Response.json({ ok: true });
      },
    });

    await t.step('/test should match url without trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/test`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });

    await t.step('/test should match url with trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/test/`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });

    await t.step('/trailing/ should match url without trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/trailing`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });

    await t.step('/trailing/ should match url with trailing /', async () => {
      const baseUrl = `http://localhost`;
      const req = new Request(`${baseUrl}/trailing/`);
      const res = await app.handle(req);
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { ok: true });
    });
  },
});
