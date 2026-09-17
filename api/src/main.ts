import 'reflect-metadata';
import 'dotenv/config';

import { Logger } from '@nestjs/common';

import { createApp } from './bootstrap';
import { getEnv } from './config/env';

async function main() {
  // Before Nest: a bad config must stop the process with a readable list of
  // setting names, not surface later as a DI error or a failed first request.
  const env = getEnv();

  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
