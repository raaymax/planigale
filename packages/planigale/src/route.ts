import type { Req } from './req.ts';
import type { Context, EndContext } from './context.ts';
import { FindSymbol } from './symbols.ts';

export * from './errors.ts';

/** Function that returns a response object. */
export type ResponseFn = () => Promise<Response> | Response;
/** Object that has a method `toResponse` that returns a response object. */
export type ResponseFactory = { toResponse: () => Response | Promise<Response> }; // | (() => Response | Promise<Response>);
/** Response, object or a function that returns a response object. */
export type ResponseLike =
  | Response
  | Promise<Response>
  | ResponseFn
  | Promise<ResponseFn>
  | ResponseFactory
  | Promise<ResponseFactory>;
/** Next function. */
export type Next = () => Promise<ResponseLike>;
/** Middleware function. */
export type Middleware = (req: Req, next: Next) => Promise<ResponseLike>;
/** Route handler function. */
export type Handler = (req: Req) => ResponseLike;

export class BaseRoute {
  /** @ignore */
  id: string = Math.random().toString(36).slice(2);
  #middlewares: Middleware[] = [];

  /** This method is used to attach middleware to the route or router.
   * @param middleware - Middleware function.
   */
  use(middleware: Middleware): void {
    this.#middlewares.unshift(middleware);
  }
  /** @ignore */
  [FindSymbol](_req: Req, _ctx: Context): EndContext | undefined {
    return undefined;
  }
  /** Gets list of middlewares attached to the route or router. */
  getMiddlewares(): Middleware[] {
    return this.#middlewares;
  }
}

/** Route definition object. */
export type RouteDef = {
  /** HTTP method of the route. */
  method: string | string[];
  /** URL pattern of the route. */
  url: string;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  /** Route handler function. */
  handler: Handler;
};

/** This class is used to create a new route.
 */
export class Route extends BaseRoute {
  /** Route definition object. */
  definition: RouteDef;
  /** Route handler function. */
  handler: Handler;

  /** Create a new route object.
   * @param def - Route definition object.
   * @example
   * ```ts
   * const app = new Planigale();
   * const route = new Route({
   *   url: '/',
   *   method: 'GET',
   *   handler: (req, res) => res.send('Hello World!')
   * });
   * app.use(route);
   * ```
   */
  constructor(def: RouteDef) {
    super();
    this.definition = def;
    this.handler = def.handler;
  }

  /** HTTP method of the route. */
  get method(): string[] {
    return [this.definition.method].flat();
  }

  /** @ignore */
  [FindSymbol](req: Req, ctx: Context): EndContext | undefined {
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

/** This class is used to create a new router.
 * Can be used to aggregate middlewares, routes and other routers.
 */
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
  /** This method is used to add a new route or router to the server.
   * @param router - The router or route to be added to the server.
   * @example
   * ```ts
   * const app = new Planigale();
   * const route = new Route({url: '/hello', method: 'GET', handler: (req, res) => res.send('Hello World!')});
   * app.use(route);
   * const request = new Request('http://localhost:8000/hello', {method: 'GET'});
   * const response = await app.handle(request);
   * console.log(response);
   * ```
   */
  use(router: BaseRoute): void;
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
  use(arg: string | Middleware | BaseRoute, arg2?: BaseRoute): void {
    if (typeof arg === 'function') {
      super.use(arg);
    } else if (arg instanceof BaseRoute) {
      this.#routes.push({ url: '', route: arg });
    } else {
      if (!arg2) throw new Error('Router must be provided');
      this.#routes.push({ url: arg, route: arg2 });
    }
  }

  /** This method is used to create a new route. It will return a Route object.
   * You can use this method to create a new route and add it to the server.
   * Its just shorter version of creating a new `Route` object and adding it to the server using `use` function.
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
    this.use(route);
    return route;
  }

  /** @ignore */
  [FindSymbol](req: Req, ctx: Context): EndContext | undefined {
    for (const { route, url } of this.#routes) {
      const end = route[FindSymbol](req, ctx.goto(url, this));
      if (end) return end;
    }
    return undefined;
  }
}
