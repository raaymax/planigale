import {JSONSchema} from 'json_schema_typed';
import { Ajv, ValidateFunction } from "npm:ajv";
import {ValidationFailed } from './errors.ts';
import { Req } from './req.ts';
import { Res } from './res.ts';

export * from './errors.ts';

const ajv = new Ajv({
	allErrors: true,
	useDefaults: true,
	coerceTypes: true,
});

export type Handler = (req: Req, res: Res) => void | Promise<void>;

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

export class Route {
	definition: RouteDef;
  pattern: URLPattern;
  validation: {
    body?: ValidateFunction,
    params?: ValidateFunction,
    query?: ValidateFunction,
    headers?: ValidateFunction,
  } = {};
  handler: Handler;

	constructor(def: RouteDef) {
		this.definition = def;
		this.pattern = new URLPattern({ pathname: def.url });
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

  match(request: Request) {
    return this.pattern.test(request.url) && 
      this.method.includes(request.method);
  }

	preProcess(req: Req) {
		const match = this.pattern.exec(req.url);
		req.params = match?.pathname.groups ?? {};
		req.path = match?.pathname.input ?? "";
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
