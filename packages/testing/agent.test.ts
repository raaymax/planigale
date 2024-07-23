import { Planigale, Req, Res } from '@planigale/planigale';
import { Agent } from './agent.ts';

const app = new Planigale();

app.route({
  method: 'GET',
  url: '/ping',
  schema: {},
  handler: (req: Req) => {
    const data: { ok: boolean; bar?: 'foo' } = { ok: true };
    if (req.cookies.get('foo') === 'bar') {
      data.bar = 'foo';
    }
    return Response.json(data);
  },
});

app.route({
  method: 'POST',
  url: '/foo',
  schema: {},
  handler: () => {
    const res = new Res();
    res.status = 200;
    res.cookies.set('foo', 'bar');
    res.send({ bar: true });
    return res;
  },
});

Deno.test(`[AGENT] testing request building `, async () => {
  await Agent.server(app, async (agent: Agent) => {
    await agent.request()
      .get('/ping')
      .expect(200, { ok: true });
  });
});

Deno.test(`[AGENT] agent should remember cookies`, async () => {
  await Agent.server(app, async (agent: Agent) => {
    await agent.request()
      .post('/foo')
      .json({ bar: true })
      .expect(200, { bar: true });

    await agent.request()
      .get('/ping')
      .expect(200, { ok: true, bar: 'foo' });
  });
});
