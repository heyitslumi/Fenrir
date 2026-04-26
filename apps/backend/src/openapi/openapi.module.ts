import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller.js';
import { OpenApiDocsController } from './openapi.docs.controller.js';
import { OpenApiService } from './openapi.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [OpenApiController, OpenApiDocsController],
  providers: [OpenApiService],
})
export class OpenApiModule {}
