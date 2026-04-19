import { Module } from '@nestjs/common';
import { ServersService } from './servers.service.js';
import { ServersController } from './servers.controller.js';
import { CalagopusModule } from '../pelican/pelican.module.js';

@Module({
  imports: [CalagopusModule],
  providers: [ServersService],
  controllers: [ServersController],
  exports: [ServersService],
})
export class ServersModule {}
