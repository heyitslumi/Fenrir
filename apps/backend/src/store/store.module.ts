import { Module } from '@nestjs/common';
import { StoreService } from './store.service.js';
import { StoreController } from './store.controller.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  providers: [StoreService],
  controllers: [StoreController],
  exports: [StoreService],
})
export class StoreModule {}
