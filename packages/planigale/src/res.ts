import { SSESink } from '@planigale/sse';
import { Cookies } from './cookies.ts';
import type { ResponseLike } from './route.ts';

export class Res {
  body: unknown;
  status: number = 200;
  headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  cookies: Cookies = new Cookies(this.headers);

  static json(data: unknown, opts?: ResponseInit): Res {
    const res = new Res();
    res.body = data;
    res.headers.set('Content-Type', 'application/json');
    res.status = opts?.status || 200;
    return res;
  }

  send(data: unknown): Res {
    this.body = data;
    return this;
  }

  sendEvents(): SSESink {
    const target = new SSESink();
    for (const [key, value] of Object.entries(target.getHeaders())) {
      this.headers.set(key, value);
    }
    this.body = target.getStream();
    return target;
  }

  toResponse(): Response {
    if (this.body instanceof ReadableStream) {
      return new Response(this.body, {
        status: this.status,
        headers: this.headers,
      });
    }
    return new Response(JSON.stringify(this.body), {
      status: this.status,
      headers: this.headers,
    });
  }

  static async makeResponse(resPromise: ResponseLike): Promise<Response> {
    const res = await resPromise;
    if (res instanceof Response) {
      return res;
    } else if (typeof res === 'function') {
      return await res();
    }
    return await res.toResponse();
  }
}
