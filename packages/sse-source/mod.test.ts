import { SSESource, SSESink } from "./mod.ts";
import assert from "node:assert";


Deno.test("SSESource and SSESink", async () => {
	const sink = new SSESink();
	const source = new SSESource('http://127.0.0.1/sse', {fetch: async () => sink.getReponse()});
	return await new Promise<void>((resolve) => {
		let counter = 0
		source.addEventListener("message", (e) => {
			counter++;
		})
		source.addEventListener("error", (e) => {
			assert.equal(counter, 2);
			console.log('resolved')
			source.close();
			resolve();
		})
		sink.sendMessage({data:"Test"});
		sink.sendMessage({data:"Test2"});
		sink.close();
	});
});
