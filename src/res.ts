import { SSESink } from '@codecat/sse';
import { Cookies } from './cookies.ts';

export class Res {
  body: unknown;
  stream?: ReadableStream<Uint8Array>;
  status: number = 200;
  headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  cookies: Cookies = new Cookies(this.headers);

  send(data: unknown): Res {
    this.body = data;
    return this;
  }

  sendEvents(): SSESink {
    const target = new SSESink();
    for (const [key, value] of Object.entries(target.getHeaders())) {
      this.headers.set(key, value);
    }
    this.stream = target.getStream();
    return target;
  }

  serialize(): Response {
    if (this.stream && this.headers.get('content-type') === 'text/event-stream') {
      return new Response(this.stream, {
        status: this.status,
        headers: this.headers,
      });
    }
    return new Response(JSON.stringify(this.body), {
      status: this.status,
      headers: this.headers,
    });
  }
}
