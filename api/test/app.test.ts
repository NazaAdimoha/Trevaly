import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './support/app';

/**
 * The contract both clients already depend on (plan Part 4): the error shape,
 * validation messages, and the one ported endpoint. These are the properties
 * that break silently — every client shows a generic error and nothing crashes.
 */

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

const http = () => request(app.getHttpServer());

describe('GET /api/app/config', () => {
  it('matches the web route body exactly', async () => {
    const res = await http().get('/api/app/config').expect(200);

    expect(Object.keys(res.body).sort()).toEqual(
      ['cloudinaryCloudName', 'features', 'minimumVersion', 'updateMessage', 'webDashboardUrl'],
    );
    expect(res.body.updateMessage).toBe(
      'Update the app to keep taking orders. The new version is in the store.',
    );
    expect(res.body.features).toEqual({
      orders: true,
      products: true,
      addProduct: true,
      push: false,
    });
    expect(res.body.webDashboardUrl).toMatch(/^https:\/\/[^/]+\/dashboard$/);
  });

  it('sends the same Cache-Control as the web route', async () => {
    const res = await http().get('/api/app/config');
    expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=300');
  });
});

describe('GET /api/health', () => {
  it('reports the database it actually queried', async () => {
    const res = await http().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('ok');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('error shape', () => {
  it('keeps an ApiException body, extra fields included', async () => {
    const res = await http().get('/api/_probe/api-exception').expect(409);
    expect(res.body).toEqual({
      error: 'Cannot move an order from PAID to PENDING',
      allowed: ['PROCESSING'],
    });
  });

  it('turns an unknown error into a generic 500 without leaking its message', async () => {
    const res = await http().get('/api/_probe/boom').expect(500);
    expect(res.body).toEqual({ error: 'Something went wrong' });
    expect(res.text).not.toContain('db-secret-host');
  });

  it('answers an unknown route with { error }, not Nest’s shape', async () => {
    const res = await http().get('/api/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('answers malformed JSON with { error }, not an HTML page', async () => {
    const res = await http()
      .post('/api/_probe/zod')
      .set('content-type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });
});

describe('body limits', () => {
  it('accepts a body the size of a full product import', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      name: `Product ${i}`,
      description: 'x'.repeat(600),
    }));
    const res = await http().post('/api/_probe/raw').send({ rows });
    expect(res.status).toBe(200);
    expect(res.body.rawBytes).toBeGreaterThan(100_000);
  });

  it('refuses an oversized body with { error }, not a 500', async () => {
    const res = await http()
      .post('/api/_probe/raw')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(2_100_000) }))
      .expect(413);
    expect(res.body).toEqual({ error: 'Request body too large' });
  });
});

describe('ZodPipe', () => {
  it('rejects with the endpoint’s own message and the issues', async () => {
    const res = await http().post('/api/_probe/zod').send({ name: '' }).expect(400);
    expect(res.body.error).toBe('Invalid thing');
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['name'] })]),
    );
  });

  it('passes parsed data through', async () => {
    const res = await http().post('/api/_probe/zod').send({ name: 'Ankara' }).expect(200);
    expect(res.body).toEqual({ name: 'Ankara' });
  });
});

describe('request plumbing', () => {
  it('keeps the exact raw bytes for webhook signatures', async () => {
    // Deliberately odd spacing: a re-serialised body would be shorter.
    const payload = '{ "event" :  "charge.success" }';
    const res = await http()
      .post('/api/_probe/raw')
      .set('content-type', 'application/json')
      .send(payload)
      .expect(200);
    expect(res.body.rawBytes).toBe(Buffer.byteLength(payload));
  });

  it('echoes a well-formed x-request-id and replaces a malformed one', async () => {
    const kept = await http().get('/api/app/config').set('x-request-id', 'vercel-abc12345');
    expect(kept.headers['x-request-id']).toBe('vercel-abc12345');

    const replaced = await http()
      .get('/api/app/config')
      .set('x-request-id', 'bad id\twith "quotes"');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not advertise Express', async () => {
    const res = await http().get('/api/app/config');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('guards without a session', () => {
  it.each(['/api/_probe/me', '/api/_probe/stores/adaobi-store', '/api/_probe/platform'])(
    '%s → 401 Not signed in',
    async (path) => {
      const res = await http().get(path).expect(401);
      expect(res.body).toEqual({ error: 'Not signed in' });
    },
  );

  it('treats a forged bearer token as signed out, not as an error', async () => {
    const res = await http()
      .get('/api/_probe/me')
      .set('authorization', 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.c2ln')
      .expect(401);
    expect(res.body).toEqual({ error: 'Not signed in' });
  });
});
