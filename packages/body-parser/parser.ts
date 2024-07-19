import { Middleware } from '@planigale/planigale';
import { qs } from './deps.ts';

export const bodyParser: Middleware = async (req, _res, next) => {
  const request = req.request;
  req.body = await loadBody(request);
  await next();
};

const loadBody = async (request: Request) => {
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await request.json();
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    return qs.parse(await request.text());
  } else if (contentType?.includes('multipart/form-data')) {
    const formData = await request.formData();
    // deno-lint-ignore no-explicit-any
    const body: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }
    return body;
  } else if (contentType?.includes('text/plain')) {
    return await request.text();
  } else {
    return request.body;
  }
};
