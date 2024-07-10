import type { Planigale } from './mod.ts';
import type { HttpServer } from './types.ts';
import { createEventSource } from './eventstream.ts';

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


export class TestingSrv implements Testing {
	static name = 'HTTP';
	srv: HttpServer<Deno.NetAddr> | null = null;
	baseUrl: string = 'http://localhost';

	constructor(private app: Planigale) {
		this.EventSource = createEventSource(fetch);
	}

	getUrl = () => {
		return this.baseUrl;
	}

	listen = async () => {
		const srv = await this.app.serve({ port: 0, onListen: (addr) => {
			console.log('Listening on:', addr.hostname, addr.port);
		}});
		const baseUrl = `http://localhost:${srv.addr.port}`;
		this.baseUrl = baseUrl;
		this.srv = srv;
	}

	fetch = async (req: Request) => {
		return await fetch(req);
	}

	EventSource: EventSourceClass; //= EventSource;

	close = () => {
		if (this.srv) {
			this.srv.shutdown();
		}
	}
}

export class TestingQuick implements Testing {
	static name = 'Handler';

	constructor(private app: Planigale) {
		this.EventSource = createEventSource(app.handle.bind(app));
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
