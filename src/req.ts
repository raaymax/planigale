import { qs } from 'qs';

export type ReqInit = {
	ip: Req['ip'],
	path: Req['path'],
	params: Req['params'],
	query: Req['query'],
	headers: Req['headers'],
	body: Req['body'],
};

export class Req {
  ip: Deno.NetAddr | string = '';
	context?: any; 
  method: string;
  url: string;
  path: string;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, any>;
  body: any;
  state: Record<string, any> = {};

	static async from(url: string, {state, ...opts}: RequestInit & {state: Record<string, any>}) {
		const request = new Request(url, opts);
		const req = await Req.fromRequest(request);
		req.state = state;
		return req;
	}

  static async fromRequest(request: Request, info?: Deno.ServeHandlerInfo) {
    const url = new URL(request.url);
    return new Req(request, {
      ip: info?.remoteAddr ?? "",
      path: url.pathname,
      params: {},
      query: qs.parse(url.search.slice(1)),
      headers: Object.fromEntries(request.headers.entries()),
      body: request.body ? await request.json() : {},
    });
  }

  constructor(public request: Request, {
    ip, path, params, query, headers, body
  }: ReqInit ) {
    this.ip = ip;
    this.method = request.method;
    this.url = request.url;
    this.path = path;
    this.params = params;
    this.query = query;
    this.headers = headers;
    this.body = body;
  }
}
