import { Ajv, type ValidateFunction, type Options } from 'ajv';
import type { Route } from '../route.ts';
import type { Req } from '../req.ts';
import type { Res } from '../res.ts';
import type { Next } from '../route.ts';
import { ValidationFailed } from '../errors.ts';

type ValidationBlock = 'body' | 'params' | 'query' | 'headers';
type ValidationError = {
  block: ValidationBlock;
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
  schemaPath: string;
};


export class SchemaValidator {
	ajv = new Ajv({
		allErrors: true,
		useDefaults: true,
		coerceTypes: true,
	});
  validation: { [id: string]: {
    body?: ValidateFunction;
    params?: ValidateFunction;
    query?: ValidateFunction;
    headers?: ValidateFunction;
  }} = {};

  constructor(opts: Options = {}) { 
		this.ajv = new Ajv({
			allErrors: true,
			useDefaults: true,
			coerceTypes: true,
			...opts,
		});
  }

	compile(route: Route) {
		if(this.validation[route.id]) return;
		const def = route.definition;
		this.validation[route.id] = {
      body: def.schema?.body ? this.ajv.compile(def.schema.body) : undefined,
      params: def.schema?.params ? this.ajv.compile(def.schema.params) : undefined,
      query: def.schema?.query ? this.ajv.compile(def.schema.query) : undefined,
      headers: def.schema?.headers ? this.ajv.compile(def.schema.headers) : undefined,
    };
	}

	middleware = async (req: Req, _res: Res, next: Next) => {
		if(req.route) {
			this.compile(req.route);
			await this.validate(req.route, req);
		}
		await next();
	}

  async validate(route: Route, req: Req) {
    const errors: ValidationError[][] = await Promise.all([
      this.#validateBlock(route, 'body', req),
      this.#validateBlock(route, 'params', req),
      this.#validateBlock(route, 'query', req),
      this.#validateBlock(route, 'headers', req),
    ]);
    const fmtErrors: ValidationError[] = errors.flat().filter((e: ValidationError) => e !== null);
    if (fmtErrors.length) {
      throw new ValidationFailed(fmtErrors);
    }
    return;
  }

  async #validateBlock(route: Route, block: ValidationBlock, req: Req) {
    const validate = this.validation[route.id][block];
    if (validate) {
      const validationResult: unknown = validate(req[block]);

      if (validationResult instanceof Promise) {
        try {
          await validationResult;
        } catch (e) {
          return e.map((e: ValidationError) => ({ ...e, block: block }));
        }
      } else if (!validationResult) {
        return validate.errors
          ?.map<ValidationError>((e) => ({
            ...e,
            block: block,
          })) ?? [];
      }
    }
    return null;
  }
}
