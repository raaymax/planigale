import type { JSONSchema7 as JSONSchema } from 'json-schema';
import type { Req } from './req.ts';
import type { Res } from './res.ts';
import type { Context, EndContext } from './context.ts';

export * from './errors.ts';

export type Next = () => void | Promise<void>;
export type Middleware = (req: Req, res: Res, next: Next) => void | Promise<void>;
export type Handler = (req: Req, res: Res) => void | Promise<void>;

export class BaseRoute {
  id: string = Math.random().toString(36).slice(2);
  #middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.#middlewares.unshift(middleware);
  }
  /** @ignore */
  find(_req: Req, _ctx: Context): EndContext | undefined {
    return undefined;
  }
  getMiddlewares(): Middleware[] {
    return this.#middlewares;
  }
}

export type RouteDef = {
  method: string | string[];
  url: string;
  description?: string;
  tags?: string[];
  schema?: {
    body?: JSONSchema;
    params?: JSONSchema;
    query?: JSONSchema;
    headers?: JSONSchema;
    response?: JSONSchema;
  };
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  handler: Handler;
};

export class Route extends BaseRoute {
  definition: RouteDef;
  handler: Handler;

  constructor(def: RouteDef) {
    super();
    this.definition = def;
    this.handler = def.handler;
  }

  get method(): string[] {
    return [this.definition.method].flat();
  }

  /** @ignore */
  find(req: Req, ctx: Context): EndContext | undefined {
    const pattern = new URLPattern({ pathname: ctx.url + this.definition.url });
    if (
      pattern.test(req.url) &&
      this.method.includes(req.method)
    ) {
      return ctx.end(pattern, this);
    }
    return undefined;
  }
}

export class Router extends BaseRoute {
  #routes: { route: BaseRoute; url: string }[] = [];

  /** This method is used to add a new route or router to the server under specific mount point url.
   * @param url - The mount point of the route or router.
   * @param router - The router or route to be added to the server.
   * @example
   * ```ts
   * const app = new Planigale();
   * const router = new Router();
   * app.use('/api', router);
   * router.route({url: '/hello', method: 'GET', handler: (req, res) => res.send('Hello World!')});
   * const request = new Request('http://localhost:8000/api/hello', {method: 'GET'});
   * const response = await app.handle(request);
   * console.log(response);
   * ```
   */
  use(url: string, router: BaseRoute): void;
  /** This method is used to add a new middleware to the server.
   * @example
   * 	```ts
   * const app = new Planigale();
   * app.use(async (req, res, next) => {
   *   console.log('before');
   *   await next();
   *   console.log('after');
   * });
   * ```
   */
  use(middleware: Middleware): void;
  use(arg: string | Middleware, arg2?: BaseRoute): void {
    if (typeof arg === 'function') {
      super.use(arg);
    } else {
      if (!arg2) throw new Error('Router must be provided');
      this.#routes.push({ url: arg, route: arg2 });
    }
  }

  /** This method is used to create a new route. It will return a Route object.
   * You can use this method to create a new route and add it to the server.
   * @example
   * ```ts
   * const app = new Planigale();
   * const route = app.route({
   *   url: '/',
   *   method: 'GET',
   *   handler: (req, res) => res.send('Hello World!')
   * });
   * ```
   */
  route(def: RouteDef): Route {
    const route = new Route(def);
    this.#routes.push({ url: '', route });
    return route;
  }

  /** @ignore */
  find(req: Req, ctx: Context): EndContext | undefined {
    for (const { route, url } of this.#routes) {
      const end = route.find(req, ctx.goto(url, this));
      if (end) return end;
    }
    return undefined;
  }
}
