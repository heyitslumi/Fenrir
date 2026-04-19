import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller.js';
import { OpenApiService } from './openapi.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [OpenApiController],
  providers: [OpenApiService],
})
export class OpenApiModule {}
