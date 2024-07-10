import type { Planigale } from './mod.ts';
import type { HttpServer } from './types.ts';

type EventSourceClass = {
	new(url: string, opts?: EventSourceInit): EventSource;
}

export interface Testing {
	getUrl: () => string;
	listen: () => Promise<void>;
	fetch: (req: Request) => Promise<Response>;
	EventSource: EventSourceClass;
	close: () => void;
}


const createEventSource = (app: Planigale): EventSourceClass => class EventSourceMock extends EventTarget implements EventSource {
	CONNECTING: 0 = 0;
	OPEN: 1 = 1;
	CLOSED: 2 = 2;

	#url: string;
	#withCredentials: boolean;
	#readyState: number = 0;

	constructor(url: string, opts?: EventSourceInit) {
		super();
		this.#withCredentials = opts?.withCredentials ?? false;
		this.#url = url;
		const request = new Request(url, {
			credentials: opts?.withCredentials ? 'include' : 'omit'
		});

		app.handle(request).then((response) => {
			if(response.status !== 200) {
				this.onerror();
				return;
			}
			if(!response.body) {
				this.onerror();
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			const dispatch = (data: string) => {
				const event = new MessageEvent('message', { data });
				this.dispatchEvent(event);
			};

			const read = async () => {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				const text = decoder.decode(value);
				const lines = text.split('\n');
				for (const line of lines) {
					if (line === '') {
						continue;
					}
					dispatch(line);
				}
				read();
			};

			read();
		})
	}

	close = () => {
		this.#readyState = 2;
	}

	onopen = () => {}
	onmessage = () => {}
	onerror = () => {}
	
	get readyState() {
		return this.#readyState;
	}

	get url() {
		return this.#url;
	}

	get withCredentials() {
		return this.#withCredentials;
	}

	addEventListener: typeof EventTarget.prototype.addEventListener = EventSource.prototype.addEventListener;
}


export class TestingSrv implements Testing {
	static name = 'HTTP';
	srv: HttpServer<Deno.NetAddr> | null = null;
	baseUrl: string = 'http://localhost';

	constructor(private app: Planigale) {}

	getUrl = () => {
		return this.baseUrl;
	}

	listen = async () => {
		const srv = await this.app.serve({ port: 0, onListen: () => {}});
		const baseUrl = `http://localhost:${srv.addr.port}`;
		this.baseUrl = baseUrl;
		this.srv = srv;
	}

	fetch = async (req: Request) => {
		return await fetch(req);
	}

	EventSource: EventSourceClass = EventSource;

	close = () => {
		if (this.srv) {
			this.srv.shutdown();
		}
	}
}

export class TestingQuick implements Testing {
	static name = 'Handler';

	constructor(private app: Planigale) {
		this.EventSource = createEventSource(app);
	}

	getUrl = () => {
		return 'http://localhost';
	}

	listen = async () => {}

	fetch = async (req: Request) => {
		return await this.app.handle(req);
	}
	
	EventSource: EventSourceClass;

	close = () => {}
}
