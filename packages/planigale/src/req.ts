// deno-lint-ignore-file no-explicit-any
import { qs } from './deps.ts';
import { ServeHandlerInfo } from './types.ts';
import { Cookies } from './cookies.ts';
import type { Route } from './route.ts';

export type ReqInit = {
  ip: Req['ip'];
  path: Req['path'];
  params: Req['params'];
  query: Req['query'];
  headers: Req['headers'];
  body: Req['body'];
  cookies: Req['cookies'];
};

export class Req {
  ip: Deno.NetAddr | string = '';
  route?: Route;
  context?: any;
  method: string;
  url: string;
  path: string;
  cookies: Cookies;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, string>;
  body: any;
  state: any = {};

  static async from(url: string, { state, ...opts }: RequestInit & { state: any }): Promise<Req> {
    const request = new Request(url, opts);
    const req = await Req.fromRequest(request);
    req.state = state;
    return req;
  }

  static async fromRequest(request: Request, info?: ServeHandlerInfo): Promise<Req> {
    const url = new URL(request.url);
    return new Req(request, {
      ip: info?.remoteAddr ?? '',
      path: url.pathname,
      params: {},
      cookies: new Cookies(request.headers),
      query: qs.parse(url.search.slice(1)),
      headers: Object.fromEntries(request.headers.entries()),
      body: request.body,
    });
  }

  constructor(public request: Request, {
    ip,
    path,
    params,
    query,
    headers,
    body,
    cookies,
  }: ReqInit) {
    this.ip = ip;
    this.method = request.method;
    this.url = request.url;
    this.path = path;
    this.params = params;
    this.query = query;
    this.headers = headers;
    this.body = body;
    this.cookies = cookies;
  }
}
