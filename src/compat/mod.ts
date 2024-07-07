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

export const serve = async (serveOpts: ServeOptions, handler: ServeHandler): Promise<HttpServer<Deno.NetAddr>> => {
  console.log('isDeno', isDeno());
  console.log('isNode', isNode());

  if (isDeno()) {
    // @ts-ignore When using node this will fail type check because there is no shim for Deno.serve
    return Deno.serve(serveOpts, handler);
  } else if (isNode()) {
    return (await import('./node.ts')).serve(serveOpts, handler);
  } else {
    throw new Error('Unsupported runtime');
  }
};
