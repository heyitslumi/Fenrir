import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { CalagopusModule } from './calagopus/calagopus.module.js';
import { ServersModule } from './servers/servers.module.js';
import { StoreModule } from './store/store.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AfkModule } from './afk/afk.module.js';
import { MailModule } from './mail/mail.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    CalagopusModule,
    ServersModule,
    StoreModule,
    AdminModule,
    AfkModule,
    MailModule,
    OpenApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
