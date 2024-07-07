import { InternalServerError, ResourceNotFound, ApiError } from './errors.ts';
import { Router } from './route.ts';
import type { Next, Middleware, BaseRoute, Route, RouteDef } from './route.ts';
import { Context } from './context.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';


/**
	* Planigale main class to create a new instance of the server. 
	*/
export class Planigale extends Router {

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
			const ctx = this.find(req, new Context());
			if(!ctx) {
				throw new ResourceNotFound("Resource not found");
			}
			ctx.preProcess(req);
			await ctx.route.validate(req);

			await ctx.getRoutes().map(r=>r.getMiddlewares()).flat().reduce<Next>((acc, middleware) => {
				return async () => await middleware(req, res, acc);
			}, async () => await ctx.route.handler(req, res))();
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

