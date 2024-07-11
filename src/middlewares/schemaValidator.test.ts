import { Planigale, Req, Res } from '../mod.ts';
import assert from 'node:assert';
import { TestingQuick, TestingSrv } from '../testing.ts';
import { SchemaValidator } from './schemaValidator.ts';

[
  TestingSrv,
  TestingQuick,
].forEach((Testing) => {
  Deno.test(`[${Testing.name}] Body validation`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(validator.middleware);
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
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
          assert.deepEqual(req.body.data, 'oko');
          res.send({ ok: true });
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/body`, {
        method: 'POST',
        body: JSON.stringify({ data: 'oko' }),
      });
      const res = await fetch(req);
      assert.deepEqual(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Body validation failed`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(validator.middleware);
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
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
        handler: async (_req: Req, _res: Res) => {
          throw new Error('Should not be called');
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/body`, {
        method: 'POST',
        body: JSON.stringify({ other: 'oko' }),
      });
      const res = await fetch(req);
      assert.deepEqual(res.status, 400);
      assert.deepEqual(await res.json(), {
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
        ],
      });
    } finally {
      // Teardown
      close();
    }
  });

  Deno.test(`[${Testing.name}] Validation error aggregation`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(validator.middleware);
    const { getUrl, fetch, close, listen } = new Testing(app);
    try {
      // Setup
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
        handler: async (_req: Req, _res: Res) => {
          throw new Error('Should not be called');
        },
      });
      await listen();

      // Test
      const req = new Request(`${getUrl()}/validation/asd?asd=test`, {
        method: 'POST',
        body: JSON.stringify({ other: 'oko' }),
        headers: {
          authorization: 'token',
        },
      });
      const res = await fetch(req);
      assert.deepEqual(res.status, 400);
      assert.deepEqual(await res.json(), {
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
    } finally {
      // Teardown
      close();
    }
  });
});
