import { InternalServerError, ResourceNotFound, ApiError } from './errors.ts';
import { Router } from './route.ts';
import type { Next, Middleware, BaseRoute, Route, RouteDef } from './route.ts';
import { Context } from './context.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';


export class Planigale {
	#router = new Router();

	use(url: string, router: BaseRoute): void;
	use(middleware: Middleware): void;
	use(arg: string | Middleware, arg2?: BaseRoute): void {
		if (typeof arg === 'function') {
			this.#router.use(arg);
		} else {
			if(!arg2) throw new Error('Router must be provided');
			this.#router.use(arg, arg2);
		}
	}

	route(def: RouteDef): Route {
		return this.#router.route(def);
	}

  async handle(
    request: Request,
    info?: Deno.ServeHandlerInfo
  ): Promise<Response> {
		try {
			const req = await Req.fromRequest(request, info);
			const res = new Res();
			const ctx = this.#router.find(req, new Context());
			if(!ctx) {
				throw new ResourceNotFound("Resource not found");
			}
			ctx.preProcess(req);
			await ctx.route.validate(req);

			await ctx.getRoutes().map(r=>r.getMiddlewares()).flat().reduce<Next>((acc, middleware) => {
				return async () => await middleware(req, res, acc);
			}, async () => await ctx.route.handle(req, res))();
			return res.serialize();
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
};

