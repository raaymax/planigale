import { InternalServerError, ResourceNotFound, ApiError } from './errors.ts';
import { Route, RouteDef } from './route.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';

export type Next = () => void | Promise<void>;
export type Middleware = (req: Req, res: Res, next: Next) => void | Promise<void>;

export class Planigale {
  #routes: Route[] = [];
  #middlewares: Middleware[] = [];

  use(middleware: Middleware) {
    this.#middlewares.push(middleware);
  }

  route(def: RouteDef): Route {
    const route = new Route(def); 
    this.#routes.push(route);
		return route;
  }

  async handle(
    request: Request,
    info?: Deno.ServeHandlerInfo
  ): Promise<Response> {
		try {
			const route = this.#routes.find((route) => route.match(request));
			if (!route) {
				throw new ResourceNotFound("Resource not found");
			}
      return await this.#handleRoute(route, request, info);
    } catch(e) {
			return this.#handleErrors(e);
    }
  }

	#handleErrors(e: Error) {
		if(e instanceof ApiError) {
			if(e.log) console.error(e);
			return new Response(JSON.stringify(e.serialize()), {status: e.status});
		}
		console.error(e);
		const ise = new InternalServerError(e);
		return new Response(JSON.stringify(ise.serialize()), {status: ise.status});
	}

  serve(opts: Deno.ServeOptions): Deno.HttpServer<Deno.NetAddr> {
    return Deno.serve(opts, this.handle.bind(this));
  }

  async #handleRoute(route: Route, request: Request, info?: Deno.ServeHandlerInfo) {
    const req = await Req.fromRequest(request, info);
		route.preProcess(req);
    await route.validate(req);
    const res = new Res();

    await this.#middlewares.reduce<Next>((acc, middleware) => {
      return async () => await middleware(req, res, acc);
    }, async () => await route.handler(req, res))();
    return res.serialize();
  }
};

