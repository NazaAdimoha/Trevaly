import { Global, Module } from '@nestjs/common';

import { type Env, getEnv } from './env';

/** Injection token for the parsed environment. */
export const ENV = Symbol('ENV');
export type { Env };

/**
 * Global so every module can inject `@Inject(ENV)` without importing this one.
 * The value is the same object `main.ts` already validated before Nest booted.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => getEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
