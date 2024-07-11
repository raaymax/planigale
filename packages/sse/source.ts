import { TextLineStream } from '@std/streams';

const CONNECTING: number = 0;
const OPEN: number = 1;
const CLOSED: number = 2;

type ConnectionState = typeof CONNECTING | typeof OPEN | typeof CLOSED;

declare interface SSESourceInit extends RequestInit {
  fetch?: (req: Request) => Promise<Response>;
}

declare interface SSESourceEventMap {
  'error': Event;
  'message': MessageEvent;
  'open': Event;
}

export class SSESource extends EventTarget {
  #abortController: AbortController = new AbortController();
  #reconnectionTimerId: number | undefined;
  #reconnectionTime = 5000;
  #lastEventId: string = '';
  #readyState: ConnectionState = CONNECTING;
  #input: Request | string;
  #options: RequestInit | undefined;
  #fetch: (req: Request) => Promise<Response>;

  get readyState(): ConnectionState {
    return this.#readyState;
  }
  get CONNECTING(): 0 {
    return 0;
  }
  get OPEN(): 1 {
    return 1;
  }
  get CLOSED(): 2 {
    return 2;
  }
  get url(): string {
    return typeof this.#input === 'string' ? this.#input : this.#input.url;
  }
  get onopen(): null {
    return null;
  }

  set onopen(value: never) {
    throw new Error('Not implemented');
  }

  get onmessage(): null {
    return null;
  }

  set onmessage(value: never) {
    throw new Error('Not implemented');
  }

  get onerror(): null {
    return null;
  }

  set onerror(value: never) {
    throw new Error('Not implemented');
  }

  constructor(input: Request | string, opts?: SSESourceInit) {
    super();
    const { fetch: f = fetch, ...options } = opts ?? {};
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
    // deno-lint-ignore no-explicit-any
    listener: (this: SSESource, ev: SSESourceEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // deno-lint-ignore no-explicit-any
    (super.addEventListener as any)(type, listener, options);
  }

  removeEventListener<K extends keyof SSESourceEventMap>(
    type: K,
    // deno-lint-ignore no-explicit-any
    listener: (this: SSESource, ev: SSESourceEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    // deno-lint-ignore no-explicit-any
    (super.removeEventListener as any)(type, listener, options);
  }

  async #loop() {
    const lastEventIdValue = this.#lastEventId;
    const headers = new Headers({
      'accept': 'text/event-stream',
			...(typeof this.#input === 'string' ? {} : Object.fromEntries(this.#input.headers.entries()))
   });
    if (lastEventIdValue !== '') {
      // ["Last-Event-Id", op_utf8_to_byte_string(lastEventIdValue)],
      headers.set('Last-Event-Id', lastEventIdValue);
    }

    const req = new Request(
      this.#input,
      {
        ...this.#options,
        headers,
        signal: this.#abortController.signal,
      },
    );
    let res: Response;
    try {
      res = await this.#fetch(req);
    } catch {
      this.#reestablishConnection();
      return;
    }

    if (res.type === 'error') {
      this.#reestablishConnection();
      return;
    }
    const contentType = res.headers.get('content-type');
    if (
      res.status !== 200 ||
      !contentType ||
      !contentType.toLowerCase().includes('text/event-stream') || res.body === null
    ) {
      this.#failConnection();
      return;
    }

    if (this.#readyState === CLOSED) {
      return;
    }
    this.#readyState = OPEN;
    this.dispatchEvent(new Event('open'));

    let data = '';
    let eventType = '';
    let lastEventId = this.#lastEventId;

    try {
      for await (
        // deno-lint-ignore prefer-primordials
        const chunk of res.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new TextLineStream({ allowCR: true }))
      ) {
        if (chunk === '') {
          this.#lastEventId = lastEventId;
          if (data === '') {
            eventType = '';
            continue;
          }
          if (data.endsWith('\n')) {
            data = data.slice(0, -1);
          }
          const event = new MessageEvent(eventType || 'message', {
            data,
            origin: res.url,
            lastEventId: this.#lastEventId,
          });
          //setIsTrusted(event, true);
          data = '';
          eventType = '';
          if (this.#readyState !== CLOSED) {
            this.dispatchEvent(event);
          }
        } else if (chunk.startsWith(':')) {
          continue;
        } else {
          let field = chunk;
          let value = '';
          const colonIndex = chunk.indexOf(':');
          if (colonIndex !== -1) {
            field = chunk.slice(0, colonIndex);
            value = chunk.slice(colonIndex + 1);
            if (value.startsWith(' ')) {
              value = value.slice(1);
            }
          }

          switch (field) {
            case 'event': {
              eventType = value;
              break;
            }
            case 'data': {
              data += value + '\n';
              break;
            }
            case 'id': {
              if (!value.includes('\0')) {
                lastEventId = value;
              }
              break;
            }
            case 'retry': {
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
    this.dispatchEvent(new Event('error'));
    if (this.#abortController.signal.aborted) {
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
      this.dispatchEvent(new Event('error'));
    }
  }

  [Symbol.for('Deno.customInspect')](
    inspect: typeof Deno.inspect,
    options: Deno.InspectOptions,
  ): string {
    return `EventSourceMock ${
      inspect({
        readyState: this.readyState,
        url: this.url,
        // deno-lint-ignore no-explicit-any
        onopen: (this as any).onopen,
        // deno-lint-ignore no-explicit-any
        onmessage: (this as any).onmessage,
        // deno-lint-ignore no-explicit-any
        onerror: (this as any).onerror,
      }, options)
    }`;
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
