import type { Planigale } from './mod.ts';
import type { HttpServer } from './types.ts';
import { SSESource } from '@codecat/sse';

export interface Testing {
  getUrl: () => string;
  listen: () => Promise<void>;
  fetch: (req: Request) => Promise<Response>;
  close: () => void;
}

export class TestingSrv implements Testing {
  static name = 'HTTP';
  srv: HttpServer<Deno.NetAddr> | null = null;
  baseUrl: string = 'http://127.0.0.1';

  constructor(private app: Planigale) {}

  getUrl: () => string = () => {
    return this.baseUrl;
  };

  listen: () => Promise<void> = async () => {
    const srv = await this.app.serve({ port: 0, onListen: () => {} });
    const baseUrl = `http://${srv.addr.hostname}:${srv.addr.port}`;
    this.baseUrl = baseUrl;
    this.srv = srv;
  };

  fetch: (req: Request) => Promise<Response> = async (req: Request) => {
    return await fetch(req);
  };

  createEventSource: (url: string) => SSESource = (url: string) => {
    return new SSESource(url);
  };

  close: () => void = () => {
    if (this.srv) {
      this.srv.shutdown();
    }
  };
}

export class TestingQuick implements Testing {
  static name = 'Handler';

  constructor(private app: Planigale) {}

  getUrl: () => string = () => {
    return 'http://localhost';
  };

  listen: () => Promise<void> = async () => {};

  fetch: (req: Request) => Promise<Response> = async (req: Request) => {
    return await this.app.handle(req);
  };

  createEventSource: (url: string) => SSESource = (url: string) => {
    return new SSESource(url, { fetch: this.fetch });
  };

  close: () => void = () => {};
}
