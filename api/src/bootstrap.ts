import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import type { Env } from './config/env';

/** Options every instance of the app is created with, deployed or under test. */
export const APP_OPTIONS = {
  // Webhook signatures are computed over the exact bytes Paystack sent.
  // Re-serialising a parsed body changes them (plan Part 4, row 4).
  rawBody: true,
} as const;

/**
 * Everything applied to the app after creation. Shared by `main.ts` and the
 * tests, so what is tested is what is deployed.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
  // Render terminates TLS at one proxy. Trusting exactly that many hops makes
  // `req.ip` the client's address — which rate limits key on — without letting
  // a client spoof it through its own `x-forwarded-for`.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  // Explicit, not body-parser's 100 KB default: a 500-row product import
  // with descriptions is larger than that, and web's route handlers have no
  // limit at all. Registered before init, so it replaces Nest's default parser
  // and still records `rawBody`.
  app.useBodyParser('json', { limit: '2mb' });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());

  app.enableCors({
    // An explicit list, never `*` with credentials. Mobile requests are not
    // subject to CORS at all; this is for the web dashboard only.
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  // SIGTERM from Render during a deploy: stop taking requests, finish the
  // in-flight ones, close the pool. See `maxShutdownDelaySeconds` in render.yaml.
  app.enableShutdownHooks();
}

export async function createApp(env: Env): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...APP_OPTIONS,
    // One JSON object per line in production, which Render's log stream and
    // any drain can parse. Readable single lines locally.
    logger: new ConsoleLogger(
      env.NODE_ENV === 'production'
        ? { json: true, colors: false }
        : { compact: true, breakLength: Infinity },
    ),
  });
  configureApp(app, env);
  return app;
}
