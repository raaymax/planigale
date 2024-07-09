
import { Planigale } from './mod.ts';
import { HttpServer } from './types.ts';

export interface Testing {
	getUrl: () => string;
	listen: () => Promise<void>;
	fetch: (req: Request) => Promise<Response>;
	close: () => void;
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

	close = () => {
		if (this.srv) {
			this.srv.shutdown();
		}
	}
}

export class TestingQuick implements Testing {
	static name = 'Handler';

	constructor(private app: Planigale) {}

	getUrl = () => {
		return 'http://localhost';
	}

	listen = async () => {}

	fetch = async (req: Request) => {
		return await this.app.handle(req);
	}

	close = () => {}
}
