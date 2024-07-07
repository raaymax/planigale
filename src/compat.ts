export const isNode = (): boolean => {
  return "process" in globalThis 
		&& "global" in globalThis 
		&& !("Bun" in globalThis) 
		&& !("WebSocketPair" in globalThis);
}

export const isDeno = (): boolean => {
	return "Deno" in globalThis;
}


