import { type SSEEvent, SSEStream } from './stream.ts';

export class SSESink extends EventTarget {
  #keepAliveTimer: number | undefined;
  #keepAliveTime = 3000;
  stream: ReadableStream<SSEEvent>;
  ctl: ReadableStreamDefaultController<SSEEvent> | null = null;

  constructor() {
    super();
    this.stream = new ReadableStream<SSEEvent>({
      start: (controller) => {
        this.ctl = controller;
      },
      cancel: () => {
        clearTimeout(this.#keepAliveTimer);
        this.dispatchEvent(new Event('close'));
        this.ctl?.close();
      },
    });

    this.#loop();
  }

  sendMessage(message: SSEEvent): void {
    this.ctl?.enqueue(message);
  }

  close(): void {
    clearTimeout(this.#keepAliveTimer);
    this.ctl?.close();
  }

  // keep-alive by sending comments
  #loop(): void {
    this.#keepAliveTimer = setTimeout(() => {
      this.sendMessage({ comment: 'keep-alive' });
      this.#loop();
    }, this.#keepAliveTime);
  }

  getHeaders(): Record<string, string> {
    return {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'keep-alive': `timeout=${Number.MAX_SAFE_INTEGER}`,
    };
  }

  getStream(): ReadableStream<Uint8Array> {
    return this.stream.pipeThrough(new SSEStream());
  }

  toResponse(): Response {
    if (!this.stream) {
      throw new Error('No stream');
    }
    return new Response(this.getStream(), {
      headers: this.getHeaders(),
    });
  }
}
