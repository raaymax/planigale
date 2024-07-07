export class Res {
  body: unknown;
  status: number = 200;
  headers: Headers = new Headers({ 'Content-Type': 'application/json' });

  send(data: unknown): Res {
    this.body = data;
    return this;
  }

  serialize(): Response {
    return new Response(JSON.stringify(this.body), {
      status: this.status,
      headers: this.headers,
    });
  }
}
