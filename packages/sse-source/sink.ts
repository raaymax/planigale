import { ServerSentEventStream, ServerSentEventMessage } from '@std/http';

export type SSEMessage = ServerSentEventMessage;

export class SSESink {
	#keepAliveTimer: number | undefined;
	#keepAliveTime = 3000;
	stream: ReadableStream<SSEMessage>;
	ctl: ReadableStreamDefaultController<SSEMessage> | null = null;

	constructor() {
		this.stream = new ReadableStream<SSEMessage>({
			start: (controller) => {
				this.ctl = controller
			}
		})

		this.#loop();
	}

	sendMessage(message: SSEMessage): void {
		this.ctl?.enqueue(message);
	}

	close(): void {
		clearTimeout(this.#keepAliveTimer);
		this.ctl?.close();
	}
	
	// keep-alive by sending comments
	#loop() {
		this.#keepAliveTimer = setTimeout(() => {
			this.sendMessage({comment: "keep-alive"});
			this.#loop();
		}, this.#keepAliveTime);
	}

	getReponse(): Response {
		if (!this.stream) {
			throw new Error("No stream");
		}
		return new Response(this.stream.pipeThrough(new ServerSentEventStream()), {
			headers: {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				"connection": "keep-alive",
				"keep-alive": `timeout=${Number.MAX_SAFE_INTEGER}`
			}
		});
	}
}
