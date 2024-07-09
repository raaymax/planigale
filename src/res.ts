import { ServerSentEventStream, ServerSentEventMessage } from '@std/http';
import { Cookies } from './cookies.ts';

type SSEMessage = ServerSentEventMessage;

class SSEHandler {
	stream: ReadableStream<SSEMessage>;
	ctl: ReadableStreamDefaultController<SSEMessage> | null = null;

	constructor() {
		this.stream = new ReadableStream<ServerSentEventMessage>({
			start: (controller) => {
				this.ctl = controller
			}
		})
	}

	sendMessage(message: ServerSentEventMessage): void {
		this.ctl?.enqueue(message);
	}

	close(): void {
		this.ctl?.close();
	}
}

export class Res {
  body: unknown;
	stream?: ReadableStream<SSEMessage>
  status: number = 200;
  headers: Headers = new Headers({ 'Content-Type': 'application/json' });
	cookies: Cookies = new Cookies(this.headers);

  send(data: unknown): Res {
    this.body = data;
    return this;
  }

	sendEvents(): SSEHandler {
		this.headers.set("content-type", 'text/event-stream')
		this.headers.set("cache-control", 'no-cache')
		this.headers.set("connection", 'keep-alive')
		this.headers.set("keep-alive", `timeout=${Number.MAX_SAFE_INTEGER}`)
		const target = new SSEHandler();
		this.stream = target.stream;
		return target;
	}

  serialize(): Response {
		if ( this.stream && this.headers.get('content-type') === 'text/event-stream' ) {
			return new Response(this.stream.pipeThrough(new ServerSentEventStream()), {
				status: this.status,
				headers: this.headers,
			})
		}
    return new Response(JSON.stringify(this.body), {
      status: this.status,
      headers: this.headers,
    });
  }
}
