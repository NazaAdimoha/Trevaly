import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { APP_OPTIONS, configureApp } from '../../src/bootstrap';
import { getEnv } from '../../src/config/env';

import { ProbeController } from './probe.controller';

@Module({ imports: [AppModule], controllers: [ProbeController] })
class TestAppModule {}

/** The deployed app configuration, plus the probe routes, not listening. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...APP_OPTIONS,
    logger: ['error'],
  });
  configureApp(app, getEnv());
  await app.init();
  return app;
}
