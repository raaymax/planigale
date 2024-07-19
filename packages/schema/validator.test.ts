import { Planigale, Req, Res } from '@planigale/planigale';
import { assertEquals } from './deps_test.ts';
import { Agent, TestingQuick, TestingSrv } from '@planigale/testing';
import { SchemaValidator } from './validator.ts';
import { bodyParser } from '@planigale/body-parser';

[
  TestingSrv,
  TestingQuick,
].forEach((Testing) => {
  Deno.test(`[VALIDATION] [${Testing.name}] Body validation`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(bodyParser);
    app.use(validator.middleware);
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

    await Agent.server(app, async (agent) => {
      await agent.request()
        .post('/body')
        .json({ data: 'oko' })
        .expect(200, { ok: true });
    });
  });

  Deno.test(`[VALIDATION] [${Testing.name}] Body validation failed`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(bodyParser);
    app.use(validator.middleware);
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

    await Agent.server(app, async (agent) => {
      await agent.request()
        .post('/body')
        .json({ other: 'oko' })
        .expect(400, {
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
    });
  });

  Deno.test(`[VALIDATION] [${Testing.name}] Validation error aggregation`, async () => {
    const app = new Planigale();
    const validator = new SchemaValidator();
    app.use(bodyParser);
    app.use(validator.middleware);
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

    await Agent.server(app, async (agent) => {
      await agent.request()
        .post('/validation/asd?asd=test')
        .json({ other: 'oko' })
        .header('authorization', 'token')
        .expect(400, {
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
  });
});
