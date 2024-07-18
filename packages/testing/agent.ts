import { Planigale } from '@codecat/planigale';
import { assertEquals } from '@std/assert';
import { CookieJar, wrapFetch } from 'https://deno.land/x/another_cookiejar@v5.0.4/mod.ts';

const Serialize = Symbol('Serialize');
const Startserver = Symbol('Startserver');
const Fetch = Symbol('Fetch');

type FetchFn = (req: Request) => Promise<Response>;
export class Agent {
  fetch: FetchFn;
  cookieJar: CookieJar = new CookieJar();
  #app: Planigale;
  #addr: {
    transport: 'tcp' | 'udp';
    hostname: string;
    port: number;
  } = { transport: 'tcp', hostname: '127.0.0.1', port: 80 };

  constructor(app: Planigale) {
    this.#app = app;
    this.fetch = wrapFetch({
      cookieJar: this.cookieJar,
      fetch: async (req: string | URL | Request, init?: RequestInit) => {
        return await app.handle(new Request(req, init));
      },
    });
  }

  get [Fetch](): FetchFn {
    return this.fetch;
  }

  async [Startserver](): Promise<void> {
    this.fetch = wrapFetch({
      cookieJar: this.cookieJar,
      fetch,
    });
    const srv = await this.#app.serve({ port: 0, onListen: () => {} });
    this.#addr = srv.addr;
  }

  /**
   * Create a new request method using the provided Planigale instance.
   *
   * @param app The Planigale instance to use for the request.
   * @returns A new RequestBuilder instance for making requests.
   */
  static request(app: Planigale): RequestBuilder {
    const agent = new Agent(app);
    return new RequestBuilder(agent);
  }
  /**
   * Returns a new Agent instance with the provided Planigale app.
   * @param app The Planigale app to use
   * @returns A new Agent instance
   */
  static agent(app: Planigale): Agent {
    return new Agent(app);
  }
  /**
   * Starts the server with the given app and executes the provided function with the agent.
   * @param app - The Planigale app instance.
   * @param fn - The function to be executed with the agent.
   * @returns A promise that resolves when the function execution is complete.
   */
  static async server(app: Planigale, fn: (agent: Agent) => Promise<void>): Promise<void> {
    const agent = new Agent(app);
    await agent[Startserver]();
    await fn(agent);
    await agent.#close();
  }

  request: () => RequestBuilder = () => new RequestBuilder(this);

  async #close(): Promise<void> {
    await this.#app.close();
  }

  get addr(): string {
    let a = `http://${this.#addr.hostname}`;
    if (this.#addr.port !== 80) {
      a += `:${this.#addr.port}`;
    }
    return a;
  }
}

class RequestBuilder {
  #url: string = '';
  #method: string = 'GET';

  constructor(private parent: Agent) {}

  get [Fetch](): FetchFn {
    return this.parent[Fetch];
  }

  get(url: string): HeadersBuilder {
    this.#url = url;
    this.#method = 'GET';
    return new HeadersBuilder(this);
  }

  post(url: string): BodyBuilder {
    this.#url = url;
    this.#method = 'POST';
    return new BodyBuilder(this);
  }

  put(url: string): BodyBuilder {
    this.#url = url;
    this.#method = 'PUT';
    return new BodyBuilder(this);
  }

  delete(url: string): BodyBuilder {
    this.#url = url;
    this.#method = 'DELETE';
    return new BodyBuilder(this);
  }

  patch(url: string): BodyBuilder {
    this.#url = url;
    this.#method = 'PATCH';
    return new BodyBuilder(this);
  }

  head(url: string): HeadersBuilder {
    this.#url = url;
    this.#method = 'HEAD';
    return new HeadersBuilder(this);
  }

  options(url: string): HeadersBuilder {
    this.#url = url;
    this.#method = 'OPTIONS';
    return new HeadersBuilder(this);
  }

  trace(url: string): HeadersBuilder {
    this.#url = url;
    this.#method = 'TRACE';
    return new HeadersBuilder(this);
  }

  connect(url: string): HeadersBuilder {
    this.#url = url;
    this.#method = 'CONNECT';
    return new HeadersBuilder(this);
  }

  [Serialize](): Request {
    return new Request(this.parent.addr + this.#url, {
      method: this.#method,
    });
  }
}

class BodyBuilder {
  #headers: Record<string, string> = {};
  #body: BodyInit | null = null;

  constructor(private parent: RequestBuilder) {}

  get [Fetch](): FetchFn {
    return this.parent[Fetch];
  }

  json(body: object): HeadersBuilder {
    this.#headers['Content-Type'] = 'application/json';
    this.#body = JSON.stringify(body);
    return new HeadersBuilder(this);
  }

  formData(body: object): BodyBuilder {
    this.#headers['Content-Type'] = 'multipart/form-data';
    const formData = new FormData();
    for (const key in body) {
      formData.append(key, body[key as keyof typeof body]);
    }
    this.#body = formData;
    return this;
  }

  urlencoded(body: object): BodyBuilder {
    this.#headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const urlencoded = new URLSearchParams();
    for (const key in body) {
      urlencoded.append(key, body[key as keyof typeof body]);
    }
    this.#body = urlencoded;
    return this;
  }

  text(body: string): BodyBuilder {
    this.#headers['Content-Type'] = 'text/plain;charset=UTF-8';
    this.#body = body;
    return this;
  }

  file(body: BodyInit): BodyBuilder {
    this.#body = body;
    return this;
  }

  [Serialize](): Request {
    return new Request(this.parent[Serialize](), {
      headers: new Headers(this.#headers),
      body: this.#body,
    });
  }
}

class HeadersBuilder {
  #headers: Record<string, string> = {};

  constructor(private parent: BodyBuilder | RequestBuilder) {}

  get [Fetch](): FetchFn {
    return this.parent[Fetch];
  }

  header(key: string, value: string): HeadersBuilder {
    this.#headers[key] = value;
    return this;
  }
  headers(headers: Record<string, string>): HeadersBuilder {
    this.#headers = { ...this.#headers, ...headers };
    return this;
  }

  // deno-lint-ignore no-explicit-any
  expect(status: number, body: any): Tester {
    const tester = new Tester(this);
    return tester.expect(status, body);
  }

  [Serialize](): Request {
    const req = this.parent[Serialize]();
    return new Request(req, {
      headers: new Headers({
        ...Object.fromEntries(req.headers.entries()),
        ...this.#headers,
      }),
    });
  }
}

type TestFn = (res: Response) => Promise<void> | void;
class Tester {
  #expectations: TestFn[] = [];

  constructor(private parent: HeadersBuilder) {}

  get [Fetch](): FetchFn {
    return this.parent[Fetch];
  }

  expect(fn: TestFn): Tester;
  // deno-lint-ignore no-explicit-any
  expect(status: number, body?: any): Tester;
  // deno-lint-ignore no-explicit-any
  expect(arg: TestFn | number, arg2?: any): Tester {
    if (typeof arg === 'function') {
      this.#expectations.push(arg);
    } else {
      const status = arg;
      const body = arg2;

      this.#expectations.push(async (res: Response) => {
        assertEquals(res.status, status);
      });

      this.#expectations.push(async (res: Response) => {
        assertEquals(await res.json(), body);
      });
    }
    return this;
  }

  async then(resolve: (res: Response) => Promise<void>): Promise<void> {
    const req = this.parent[Serialize]();
    const res = await this[Fetch](req);
    for (const expectation of this.#expectations) {
      await expectation(res);
    }
    return await resolve(res);
  }
}
