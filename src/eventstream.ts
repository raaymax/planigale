import { TextLineStream } from "@std/streams";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

type EventSourceClass = {
	new(url: string, opts?: EventSourceInit): EventSource;
}

class DebugStream extends TransformStream {
  constructor() {
    super({
      transform: (chunk, controller) => {
				console.log('chunk:', chunk);
        controller.enqueue(chunk);
      },
    });
  }
}

export const createEventSource = (fetch: (req: Request) => Promise<Response>) => {
	class EventSourceMock extends EventTarget {
		#abortController: AbortController = new AbortController();
		#reconnectionTime: number = 5000;
		#lastEventID: string = "";
		#readyState: number  = CONNECTING;
		#url: string = "";
		#withCredentials: boolean = false;

		get readyState() {
			return this.#readyState;
		}

		get CONNECTING(): 0 {
			return CONNECTING;
		}
		get OPEN(): 1 {
			return OPEN;
		}
		get CLOSED(): 2 {
			return CLOSED;
		}
		get url() {
			return this.#url;
		}
		get withCredentials() {
			return this.#withCredentials;
		}

		#open = () => {}
		get onopen() {
			return this.#open;
		}

		set onopen(value) {
			this.#open = value;
			throw new Error("Not implemented");
		}

		#message = () => {}
		get onmessage() {
			return this.#message;
		}

		set onmessage(value) {
			this.#message = value;
			throw new Error("Not implemented");
		}

		#error = () => {}
		get onerror() {
			return this.#error;
		}

		set onerror(value) {
			this.#error = value;
			throw new Error("Not implemented");
		}

		constructor(url: string, eventSourceInit: EventSourceInit = { withCredentials: false }) {
			super();
			this.#url = url;
			this.#withCredentials = eventSourceInit.withCredentials ?? false;
			this.#loop();
		}

		close() {
			this.#abortController.abort();
			console.log('close');
			this.#readyState = CLOSED;
		}

		async #loop() {
			console.log('loop');
			let lastEventIDValue = "";
			while (this.#readyState !== this.CLOSED) {
				const lastEventIDValueCopy = lastEventIDValue;
				lastEventIDValue = "";
				const headers = new Headers({
					//"accept": "text/event-stream",
				})
				if (lastEventIDValueCopy !== "") {
					headers.set("last-event-id", lastEventIDValueCopy);
				}

				const req = new Request(
					this.url,
					{ 
						method: "GET", 
						headers,
					},
				);
				console.log(req);
				let res: Response;
				try{
					res = await fetch(req);
				}catch(e){
					console.log('error:', e);
					throw e;
				}

				const contentType = res.headers.get("content-type");

				if (res.status !== 200 || !contentType || contentType.toLowerCase() !== "text/event-stream" || res.body === null) {
					this.#readyState = this.CLOSED;
					this.dispatchEvent(new Event("error"));
					break;
				}

				if (this.#readyState !== this.CLOSED) {
					this.#readyState = this.OPEN;
					this.dispatchEvent(new Event("open"));

					let data = "";
					let eventType = "";
					let lastEventID = this.#lastEventID;



					for await (
						// deno-lint-ignore prefer-primordials
						const chunk of res.body
							.pipeThrough(new DebugStream())
							.pipeThrough(new TextDecoderStream())
							.pipeThrough(new TextLineStream({ allowCR: true }))
					) {
						if (chunk === "") {
							this.#lastEventID = lastEventID;
							if (data === "") {
								eventType = "";
								continue;
							}

							if (data.endsWith("\n")) {
								data = data.slice(0, -1);
							}
							const event = new MessageEvent(eventType || "message", {
								data,
								origin: res.url,
								lastEventId: this.#lastEventID,
							});
							//event as any)[Symbol("[[isTrusted]]")] = true;
							data = "";
							eventType = "";
							if (this.#readyState !== this.CLOSED) {
								this.dispatchEvent(event);
							}
						} else if ((chunk as string).startsWith(":")) {
							continue;
						} else {
							let field = chunk;
							let value = "";
							if ((chunk as string).includes(":")) {
								({ 0: field, 1: value } = (chunk as string).split(":"));
								if (value.startsWith(" ")) {
									value = value.slice(1);
								}
							}

							switch (field) {
								case "event": {
									eventType = value;
									break;
								}
								case "data": {
									data += value + "\n";
									break;
								}
								case "id": {
									if (!value.includes("\0")) {
										lastEventID = value;
									}
									break;
								}
								case "retry": {
									const reconnectionTime = Number(value);
									if (
										!isNaN(reconnectionTime) &&
										isFinite(reconnectionTime)
									) {
										this.#reconnectionTime = reconnectionTime;
									}
									break;
								}
							}
						}

						if (this.#abortController.signal.aborted) {
							break;
						}
					}
					if (this.#readyState === this.CLOSED) {
						this.#abortController.abort();
						break;
					}
					this.#readyState = this.CONNECTING;
					this.dispatchEvent(new Event("error"));
					await new Promise((res, rej) => {
						const timer = setTimeout(res, this.#reconnectionTime)
						console.log('timer:', timer);
						this.#abortController.signal.addEventListener("abort", () => {
							console.log('abort');
							clearTimeout(timer);
							rej();
						}, { once: true });
					});
					if (this.#readyState !== this.CONNECTING) {
						continue;
					}

					if (this.#lastEventID !== "") {
						lastEventIDValue = this.#lastEventID;
					}
				}
			}
		}
	}

	Object.defineProperties(EventSourceMock, {
		CONNECTING: {
			value: 0,
		},
		OPEN: {
			value: 1,
		},
		CLOSED: {
			value: 2,
		},
	});

	return EventSourceMock as EventSourceClass;
};
/*
defineEventHandler(EventSource.prototype, "open");
defineEventHandler(EventSource.prototype, "message");
defineEventHandler(EventSource.prototype, "error");

*/
