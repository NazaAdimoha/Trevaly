import { request } from 'node:http';

export type Reply = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
  json: unknown;
};

/**
 * A raw HTTP call with full control of the Host header.
 *
 * Node's `fetch` silently ignores `Host`, and the web app routes storefront
 * requests by hostname — so a `fetch` to localhost:3000 always lands on the
 * platform host, never on a store.
 */
export function send(opts: {
  port: number;
  method: string;
  path: string;
  host?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}): Promise<Reply> {
  const payload =
    opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: opts.port,
        method: opts.method,
        path: opts.path,
        headers: {
          host: `${opts.host ?? 'localhost'}:${opts.port}`,
          ...(payload !== undefined
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload).toString(),
              }
            : {}),
          ...opts.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown = undefined;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error(`timeout ${opts.method} ${opts.path}`)));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}
