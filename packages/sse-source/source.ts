import { TextLineStream } from "@std/streams";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

declare interface SSESourceInit extends RequestInit {
	fetch?: (req: Request) => Promise<Response>;
}

declare interface SSESourceEventMap {
  "error": Event;
  "message": MessageEvent;
  "open": Event;
}


export class SSESource extends EventTarget {
	#abortController: AbortController = new AbortController();
	#reconnectionTimerId: number | undefined;
	#reconnectionTime = 5000;
	#lastEventId = "";
	#readyState = CONNECTING;
	#input: Request | string;
	#options: RequestInit | undefined;
	#fetch: (req: Request) => Promise<Response>;

	get readyState() {
		return this.#readyState;
	}
	get CONNECTING() {
		return CONNECTING;
	}
	get OPEN() {
		return OPEN;
	}
	get CLOSED() {
		return CLOSED;
	}
	get url() {
		return typeof this.#input === 'string' ? this.#input : this.#input.url;
	}
	#open = null
	get onopen() {
		return this.#open;
	}

	set onopen(value) {
		this.#open = value;
		throw new Error("Not implemented");
	}

	#message = null
	get onmessage() {
		return this.#message;
	}

	set onmessage(value) {
		this.#message = value;
		throw new Error("Not implemented");
	}

	#error = null
	get onerror() {
		return this.#error;
	}

	set onerror(value) {
		this.#error = value;
		throw new Error("Not implemented");
	}

	constructor(input: Request | string, opts ?: SSESourceInit) {
		super();
		const {fetch: f = fetch, ...options} = opts ?? {};
		this.#input = input;
		this.#options = options;
		this.#fetch = f;
		this.#loop();
	}

	close() {
		clearTimeout(this.#reconnectionTimerId);
		this.#readyState = CLOSED;
		this.#abortController.abort();
	}

  addEventListener<K extends keyof SSESourceEventMap>(
    type: K,
    listener: (this: SSESource, ev: SSESourceEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
		(super.addEventListener as any)(type, listener, options);
	}

	removeEventListener<K extends keyof SSESourceEventMap>(
		type: K,
		listener: (this: SSESource, ev: SSESourceEventMap[K]) => any,
		options?: boolean | EventListenerOptions
	): void {
		(super.removeEventListener as any)(type, listener, options);
	}
	
	async #loop() {
		const lastEventIdValue = this.#lastEventId;
		const headers = new Headers({
			"accept": "text/event-stream",
		})
		if (lastEventIdValue!== "") {
			// ["Last-Event-Id", op_utf8_to_byte_string(lastEventIdValue)],
			headers.set("Last-Event-Id", lastEventIdValue);
		}

		const req = new Request(
			this.#input,
			{
				...this.#options,
				headers,
				signal: this.#abortController.signal,
			}
		);
		let res: Response;
		try{
			res = await this.#fetch(req);
		} catch {
			this.#reestablishConnection();
			return;
		}

		if (res.type === "error") {
			this.#reestablishConnection();
			return;
		}
		const contentType = res.headers.get("content-type");
		if (res.status !== 200 
			|| !contentType 
				|| !contentType.toLowerCase().includes("text/event-stream") || res.body === null) {
			this.#failConnection();
			return;
		}

		if (this.#readyState === CLOSED) {
			return;
		}
		this.#readyState = OPEN;
		this.dispatchEvent(new Event("open"));

		let data = "";
		let eventType = "";
		let lastEventId = this.#lastEventId;

		try {
			for await (
				// deno-lint-ignore prefer-primordials
				const chunk of res.body
					.pipeThrough(new TextDecoderStream())
					.pipeThrough(new TextLineStream({ allowCR: true }))
			) {
				if (chunk === "") {
					this.#lastEventId = lastEventId;
					if (data === "") {
						eventType = "";
						continue;
					}
					if (data.endsWith('\n')) {
						data = data.slice(0, -1);
					}
					const event = new MessageEvent(eventType || "message", {
						data,
						origin: res.url,
						lastEventId: this.#lastEventId,
					});
					//setIsTrusted(event, true);
					data = "";
					eventType = "";
					if (this.#readyState !== CLOSED) {
						this.dispatchEvent(event);
					}
				} else if (chunk.startsWith(':')) {
					continue;
				} else {
					let field = chunk;
					let value = "";
					const colonIndex = chunk.indexOf(':');
					if (colonIndex !== -1) {
						field = chunk.slice(0, colonIndex)
						value = chunk.slice(colonIndex + 1);
						if (value.startsWith( " ")) {
							value = value.slice( 1);
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
								lastEventId = value;
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
			}
		} catch {
			// The connection is reestablished below
		}

		this.#reestablishConnection();
	}

	#reestablishConnection() {
		if (this.#readyState === CLOSED) {
			return;
		}
		this.#readyState = CONNECTING;
		this.dispatchEvent(new Event("error"));
		if(this.#abortController.signal.aborted) {
			return;
		}
		this.#reconnectionTimerId = setTimeout(() => {
			if (this.#readyState !== CONNECTING) {
				return;
			}
			this.#loop();
		}, this.#reconnectionTime);
	}

	#failConnection() {
		if (this.#readyState !== CLOSED) {
			this.#readyState = CLOSED;
			this.dispatchEvent(new Event("error"));
		}
	}

	[Symbol.for("Deno.customInspect")]( 
		inspect: typeof Deno.inspect,
	options: Deno.InspectOptions,
	) {
		return `EventSourceMock ${inspect({
			readyState: this.readyState,
			url: this.url,
			onopen: (this as any).onopen,
			onmessage: (this as any).onmessage,
			onerror: (this as any).onerror,
		}, options)}`;
	}
}


Object.defineProperties(SSESource, {
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
