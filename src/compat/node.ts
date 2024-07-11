import { HttpServer, ServeHandler, ServeOptions } from '../types.ts';
import http from 'node:http';
import { Buffer } from 'node:buffer';
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export const serve = (serveOpts: ServeOptions, handler: ServeHandler): HttpServer<Deno.NetAddr> => {
  const opts: WithRequired<ServeOptions, 'port'> = Object.assign({
    port: 8000,
    onError: (e: unknown) => {
      console.error(e);
      return new Response(JSON.stringify(e), { status: 500 });
    },
  }, serveOpts);

  const server = new Promise<http.Server>((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const body = new Promise<BodyInit>((resolve) => {
        const bodyBuffer: Buffer[] = [];
        req.on('data', (data) => bodyBuffer.push(data));
        req.on('end', () => {
          resolve(Buffer.concat(bodyBuffer));
        });
      });

      const port = req.socket.localPort ?? 0;
      const url = `http://${Deno.env.get('HOST') ?? 'localhost'}${port !== 80 ? ':' + port : ''}${req.url}`;

      const headers = Object.entries(req.headers).reduce((acc, [k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((v) => acc.append(k, v));
          return acc;
        } else if (v) {
          acc.append(k, v);
        }
        return acc;
      }, new Headers());

      const request = new Request(url as string, {
        method: req.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await body,
      });
      handler(request, {
        remoteAddr: {
          transport: 'tcp',
          port: req.socket.remotePort ?? 0,
          hostname: req.socket.remoteAddress ?? '',
        },
        completed: new Promise<void>((resolve) => {
          res.on('finish', resolve);
        }),
      }).then(async (response: Response) => {
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        const blob = await response.blob();
        res.write(Buffer.from(await blob.arrayBuffer()));
        res.end();
      }).catch((e) => {
        console.error(e);
        opts.onError && opts.onError(e);
      });
    });
    srv.on('error', (e) => {
      console.error(e);
    });
    srv.on('clientError', (err, socket) => {
      console.error(err);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    srv.listen(opts.port);

    return resolve(srv);
  });
  return {
    finished: new Promise<void>((resolve) => server.then((srv) => srv.on('close', resolve))),
    addr: {
      transport: 'tcp',
      port: opts.port,
      hostname: 'localhost',
    },
    unref: () => {
      throw new Error('Not supported for Node.js');
    },
    ref: () => {
      throw new Error('Not supported for Node.js');
    },
    shutdown: () =>
      new Promise<void>((resolve) => {
        server.then((srv) => srv.close(() => resolve()));
      }),
  };
};
