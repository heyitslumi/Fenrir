import { Module } from '@nestjs/common';
import { AfkGateway } from './afk.gateway.js';
import { AfkService } from './afk.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [SettingsModule, AuthModule],
  providers: [AfkGateway, AfkService],
})
export class AfkModule {}
