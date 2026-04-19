import { Module } from '@nestjs/common';
import { CalagopusService } from './pelican.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  providers: [CalagopusService],
  exports: [CalagopusService],
})
export class CalagopusModule {}
