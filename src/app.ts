import { InternalServerError, ResourceNotFound, ApiError } from './errors.ts';
import { Router } from './route.ts';
import type { Next, Middleware, BaseRoute, Route, RouteDef } from './route.ts';
import { Context } from './context.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';


/**
	* Planigale main class to create a new instance of the server. 
	*/
export class Planigale {
	#router = new Router();

	/** This method is used to add a new route or router to the server under specific mount point url.
		* @param url - The mount point of the route or router.
		* @param router - The router or route to be added to the server.
		* @example
		* const app = new Planigale();
		* const router = new Router();
		* app.use('/api', router);
		* router.route({url: '/hello', method: 'GET', handler: (req, res) => res.send('Hello World!')});
		* const request = new Request('http://localhost:8000/api/hello', {method: 'GET'});
		* const response = await app.handle(request);
		* console.log(response);
		*/
	use(url: string, router: BaseRoute): void;
	/** This method is used to add a new middleware to the server.
		* @example
		* const app = new Planigale();
		* app.use(async (req, res, next) => {
		*   console.log('before');
		*   await next();
		*   console.log('after');
		* });
		*/
	use(middleware: Middleware): void;
	use(arg: string | Middleware, arg2?: BaseRoute): void {
		if (typeof arg === 'function') {
			this.#router.use(arg);
		} else {
			if(!arg2) throw new Error('Router must be provided');
			this.#router.use(arg, arg2);
		}
	}

	/** This method is used to create a new route. It will return a Route object.
		* You can use this method to create a new route and add it to the server.
		* @example
		* const app = new Planigale();
		* const route = app.route({
		*   url: '/',
		*   method: 'GET',
		*   handler: (req, res) => res.send('Hello World!')
		* });
		*/
	route(def: RouteDef): Route {
		return this.#router.route(def);
	}

	/** This method is used to handle incoming requests. It will return a response object.
		* You can use this method to handle requests manually. Request and Response objects are the same as in fetch API.
		* This function is very useful for testing purposes as it provides all functionality of the server without the need to run it.
		* @example
		* const app = new Planigale();
		* const request = new Request('http://localhost:8000/', {method: 'GET'});
		* const response = await app.handle(request);
		* console.log(response);
		*/
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

	/** Serves the application using Deno.serve, it will return a Deno.HttpServer instance.
		* You can use the server to close the connection or to listen for incoming requests.
		* The opts parameter is the same as Deno.serve options.
		* @example
		* const app = new Planigale();
		* app.serve({ port: 8000 })
		*/
  serve(opts: Deno.ServeOptions): Deno.HttpServer<Deno.NetAddr> {
    return Deno.serve(opts, this.handle.bind(this));
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
};

