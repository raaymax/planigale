import { TextLineStream } from './deps.ts';

export declare interface SSESourceInit extends RequestInit {
  fetch?: (req: Request) => Promise<Response>;
}

type SSEEvent = {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
};

type ErrorEvent = {
  type: 'error';
  error: Error;
};

type CloseEvent = {
  type: 'close';
};

type InternalEvent = ErrorEvent | CloseEvent | (SSEEvent & { type: 'event' });

function parseMessage(message: SSEEvent, data: Record<string, string>): void {
  if (data.data) {
    message.data = data.data;
  }
  if (data.event) {
    message.event = data.event;
  }
  if (data.id) {
    message.id = data.id;
  }
  if (data.retry) {
    message.retry = parseInt(data.retry);
  }
}

class SSEDecoderStream extends TransformStream<string, SSEEvent> {
  event = { data: '' };
  constructor() {
    super({
      transform: (chunk, controller) => {
        if (!chunk) {
          controller.enqueue(this.event);
          this.event = { data: '' };
          return;
        }
        const idx = chunk.indexOf(':');
        const type = idx === -1 ? chunk : chunk.slice(0, idx);
        const val = idx === -1 ? '' : chunk.slice(idx + 1).trim();
        parseMessage(this.event, { [type]: val });
      },
    });
  }
}
async function* abortable(
  p: ReadableStream<SSEEvent>,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  signal.throwIfAborted();
  const { promise, reject } = Promise.withResolvers<never>();
  const abort = () => reject(signal.reason);
  signal.addEventListener('abort', abort, { once: true });

  const reader = p.getReader();
  try {
    while (true) {
      const { done, value } = await Promise.race([promise, reader.read()]);
      if (done) {
        return;
      }
      yield value;
    }
  } catch (e) {
    throw e;
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export class SSESource {
  #input: Request | string | URL;
  #options: RequestInit | undefined;
  #fetch: (req: Request) => Promise<Response>;
  #abortController: AbortController;
  #queue: InternalEvent[] = [];
  #waiting: ((ev: InternalEvent) => void)[] = [];
  #stream: ReadableStream<SSEEvent> | undefined;
  #closed: Promise<void>;
  #connected: () => void;
  connected: Promise<void>;

  constructor(input: Request | string | URL, opts?: SSESourceInit) {
    const { fetch: f = fetch, ...options } = opts ?? {};
    this.#abortController = new AbortController();
    ({ promise: this.connected, resolve: this.#connected } = Promise.withResolvers<void>());
    opts?.signal?.addEventListener('abort', () => this.#abortController.abort(), { once: true });
    this.#input = input;
    this.#options = options;
    this.#fetch = f;
    this.#closed = this.#loop();
  }

  async close(): Promise<void> {
    this.#abortController.abort();
    await this.#closed;
  }

  async #loop(): Promise<void> {
    await this.#connect();
    this.dispatch({ type: 'close' });
  }

  async #connect(): Promise<void> {
    const headers = new Headers({
      'accept': 'text/event-stream',
      ...(this.#input instanceof Request
        ? Object.fromEntries(this.#input.headers.entries())
        : (this.#options?.headers ?? {})),
    });

    const req = new Request(this.#input, {
      ...this.#options,
      signal: this.#abortController.signal,
      headers,
    });

    try {
      const res = await this.#fetch(req);
      if (res.status !== 200) {
        throw new Error(`Unexpected status code: ${res.status}`);
      }
      if (res.headers.get('content-type') !== 'text/event-stream') {
        throw new Error(`Unexpected content type: ${res.headers.get('content-type')}`);
      }

      await this.#connectBody(res);
    } catch (e) {
      this.dispatch({ type: 'error', error: e });
    }
  }

  async #connectBody(res: Response): Promise<void> {
    if (!res.body) {
      this.dispatch({ type: 'error', error: new Error('No response body') });
      return;
    }

    this.#stream = res.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream({ allowCR: true }))
      .pipeThrough(new SSEDecoderStream());

    this.#connected();

    try {
      for await (const event of abortable(this.#stream, this.#abortController.signal)) {
        this.dispatch({ type: 'event', ...event });
      }
    } catch (e) {
      this.dispatch({ type: 'error', error: e });
    } finally {
      try {
        await this.#stream.cancel();
      } catch (e) {
        this.dispatch({ type: 'error', error: e });
      }
    }
  }

  dispatch(event: InternalEvent): void {
    this.#queue.push(event);
    this.#handleEvent();
  }

  #handleEvent(): void {
    if (this.#waiting.length && this.#queue.length) {
      const resolve = this.#waiting.shift() as (ev: InternalEvent | null) => void;
      resolve(this.#queue.shift() ?? null);
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SSEEvent> {
    while (true) {
      const { done, event } = await this.next();
      if (done) {
        break;
      }
      yield event;
    }
  }

  async next(): Promise<{ done: false; event: SSEEvent } | { done: true; event: null }> {
    if (this.#waiting.length) {
      throw new Error('Already waiting for next event');
    }

    return new Promise<InternalEvent>((resolve) => {
      this.#waiting.push(resolve);
      this.#handleEvent();
    }).then((event) => {
      if (event.type === 'event') {
        return ({ done: false, event });
      } else if (event.type === 'error') {
        throw event.error;
      } else {
        return ({ done: true, event: null });
      }
    });
  }
}
