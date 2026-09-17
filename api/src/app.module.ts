import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { FeaturesModule } from './modules/features.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CacheModule,
    AuthModule,
    IntegrationsModule,
    AppConfigModule,
    FeaturesModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
