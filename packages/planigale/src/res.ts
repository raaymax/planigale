import { SSESink } from '@planigale/sse';
import { Cookies } from './cookies.ts';
import type { ResponseLike } from './route.ts';

/** A class representing a response, with methods for setting the body, status, headers, and cookies. */
export class Res {
  /** The body of the response. */
  body: unknown;
  /** The status code of the response. */
  status: number = 200;
  /** The headers of the response. */
  headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  /** The cookies of the response. */
  cookies: Cookies = new Cookies(this.headers);

  /** Create a new response in JSON format with status code opts.status or 200.
   * @param data - The data to send in the response body.
   * @param opts - Options for the response.
   * @returns The Res instance.
   */
  static json(data: unknown, opts?: ResponseInit): Res {
    const res = new Res();
    res.body = data;
    res.headers.set('Content-Type', 'application/json');
    res.status = opts?.status || 200;
    return res;
  }

  /** Sets the body of the response.
   * @param data - The data to send in the response body.
   * @returns this
   */
  send(data: unknown): Res {
    this.body = data;
    return this;
  }

  /**
   * Creates SSESink instance and sets the body of the response to the readable stream.
   * This converts the response to a server-sent events stream.
   * @returns The SSESink instance.
   *
   * @example
   * ```ts
   * app.route({
   *   method: 'GET',
   *   url: '/sse',
   *   handler: () => {
   *     const res = new Res();
   *     const sink = res.sendEvents();
   *     const interval = setInterval(() => sink.sendMessage({ data: 'Test' }), 1000);
   *     sink.addEventListener('close', () => clearInterval(interval));
   *     return res;
   *   }
   * });
   * ```
   */
  sendEvents(): SSESink {
    const target = new SSESink();
    for (const [key, value] of Object.entries(target.getHeaders())) {
      this.headers.set(key, value);
    }
    this.body = target.getStream();
    return target;
  }

  /**
   * Converts the res instance to a Fetch API Response.
   * @returns The Fetch API Response.
   */
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

  /**
   * @ignore
   * @internal
   */
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
