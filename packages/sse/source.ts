import { TextLineStream } from '@std/streams';

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

export class SSESource {
  #input: Request | string;
  #options: RequestInit | undefined;
  #fetch: (req: Request) => Promise<Response>;
  #abortController: AbortController;
  #queue: InternalEvent[] = [];
  #waiting: ((ev: InternalEvent) => void)[] = [];
  #stream: ReadableStream<string> | undefined;

  #connected: () => void = () => {};
  connected: Promise<void> = new Promise<void>((resolve) => {
    this.#connected = resolve;
  });

  constructor(input: Request | string, opts?: SSESourceInit) {
    const { fetch: f = fetch, ...options } = opts ?? {};
    this.#abortController = new AbortController();
    this.#input = input;
    this.#options = options;
    this.#fetch = f;
    this.#loop();
  }

  async close(): Promise<void> {
    this.#abortController.abort();
    this.dispatch({ type: 'close' });
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

  async #loop(): Promise<void> {
    await this.#connect();
  }

  async #connect(): Promise<void> {
    const headers = new Headers({
      'accept': 'text/event-stream',
      ...(typeof this.#input === 'string' ? {} : Object.fromEntries(this.#input.headers.entries())),
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
      .pipeThrough(new TextLineStream({ allowCR: true }));

    this.#connected();

    try {
      let event: SSEEvent = { data: '' };
      for await (const chunk of this.#stream) {
        if (!chunk) {
          this.dispatch({ type: 'event', ...event });
          event = { data: '' };
          continue;
        }
        const [type, val] = chunk.split(':');
        parseMessage(event, { [type]: val });
      }
      this.dispatch({ type: 'close' });
    } catch (e) {
      this.dispatch({ type: 'error', error: e });
    }
  }
}
