import {JSONSchema} from 'json-schema';
import { Ajv, ValidateFunction } from "ajv";
import { ValidationFailed } from './errors.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';
import { Context, EndContext } from './context.ts';

export * from './errors.ts';

const ajv = new Ajv({
	allErrors: true,
	useDefaults: true,
	coerceTypes: true,
});

export type Next = () => void | Promise<void>;
export type Middleware = (req: Req, res: Res, next: Next) => void | Promise<void>;
export type Handler = (req: Req, res: Res) => void | Promise<void>;

export class BaseRoute {
	#middlewares: Middleware[] = [];

	use(middleware: Middleware): void {
		this.#middlewares.push(middleware);
	}
	find(req: Req, ctx: Context): EndContext | undefined {
		return undefined;
	}
	handle(req: Req, res: Res, ctx: Context): void | Promise<void>{}

	getMiddlewares(): Middleware[]{
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
  handler: Handler;
}

export class Route extends BaseRoute {
	definition: RouteDef;
  validation: {
    body?: ValidateFunction,
    params?: ValidateFunction,
    query?: ValidateFunction,
    headers?: ValidateFunction,
  } = {};
  handler: Handler;

	constructor(def: RouteDef) {
		super();
		this.definition = def;
		this.handler = def.handler;
		this.validation = {
			body: def.schema?.body ? ajv.compile(def.schema.body) : undefined,
			params: def.schema?.params ? ajv.compile(def.schema.params) : undefined,
			query: def.schema?.query ? ajv.compile(def.schema.query) : undefined,
			headers: def.schema?.headers ? ajv.compile(def.schema.headers) : undefined,
		};
	}

	get method() {
		return [this.definition.method].flat();
	}

	find(req: Req, ctx: Context): EndContext | undefined {
		const pattern = new URLPattern({ pathname: ctx.url + this.definition.url});
		if(pattern.test(req.url) && 
			this.method.includes(req.method)){
			return ctx.end(pattern, this);
		}
		return undefined;
	}

  async validate(req: Req) {
    let errors: any = await Promise.all([
      this.#validateBlock('body', req),
      this.#validateBlock('params', req),
      this.#validateBlock('query', req),
      this.#validateBlock('headers', req),
    ]);
    errors = errors.flat().filter((e: any) => e !== null);
    if(errors.length) {
      throw new ValidationFailed(errors);
    }
    return;
  }

	async handle(req: Req, res: Res) {
		await this.handler(req, res);
	}

  async #validateBlock(block: keyof Route['validation'], req: any) {
		const validate = this.validation[block];
    if(validate) {
      const validationResult: any = validate(req[block]);

      if(validationResult instanceof Promise){
        try{ 
          await validationResult;
        }catch(e){
          return e.map((e: any) => ({...e, block: block}));
        }
      }else if(!validationResult) {
        return validate.errors?.map((e: any) => ({...e, block: block})) ?? [];
      }
    }
    return null
  }
}

export class Router extends BaseRoute {
	#routes: {route: BaseRoute, url: string}[] = [];

	use(url: string, router: BaseRoute): void;
	use(middleware: Middleware): void;
	use(arg: string | Middleware, arg2?: BaseRoute): void {
		if (typeof arg === 'function') {
			super.use(arg);
		} else {
			if(!arg2) throw new Error('Router must be provided');
			this.#routes.push({url: arg, route: arg2});
		}
	}

	route(def: RouteDef): Route {
		const route = new Route(def); 
		this.#routes.push({url: '', route});
		return route;
	}

	find(req: Req, ctx: Context): EndContext | undefined {
		for (const {route, url} of this.#routes) {
			const end = route.find(req, ctx.goto(url, this));
			if(end) return end;
		}
		return undefined;
	}
}

