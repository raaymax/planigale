import { HttpServer, ServeHandler, ServeOptions } from '../types.ts';

export const isNode = (): boolean => {
  return 'process' in globalThis &&
    'global' in globalThis &&
    !('Bun' in globalThis) &&
    !('WebSocketPair' in globalThis);
};

export const isDeno = (): boolean => {
  return 'Deno' in globalThis &&
    !('process' in globalThis) &&
    !('global' in globalThis) &&
    !('Bun' in globalThis) &&
    !('WebSocketPair' in globalThis);
};

declare global {
		let Compat: CompatType;
}


type CompatType = {
	serve: (serveOpts: ServeOptions, handler: ServeHandler) => HttpServer<Deno.NetAddr>;
};

(async () => {
	const c: CompatType = {
		serve: (()  => { 
			throw new Error('Environment not supported');
		}) as CompatType['serve'],
	};
	if(isNode()) {
		c.serve = (await import('./node.ts')).serve;
	} else if(isDeno()) {
		// @ts-ignore When using node this will fail type check because there is no shim for Deno.serve
		c.serve = Deno.serve;
	} else {
		throw new Error('Unsupported runtime');
	}
	// deno-lint-ignore no-explicit-any
	(globalThis as any).Compat = c as CompatType;
})()

export const serve = async (serveOpts: ServeOptions, handler: ServeHandler): Promise<HttpServer<Deno.NetAddr>> => {
  if (isDeno()) {
    // @ts-ignore When using node this will fail type check because there is no shim for Deno.serve
    return Deno.serve(serveOpts, handler);
  } else if (isNode()) {
    return (await import('./node.ts')).serve(serveOpts, handler);
  }
	throw new Error('Unsupported runtime');
};
