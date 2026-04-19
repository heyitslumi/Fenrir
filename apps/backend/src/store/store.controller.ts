import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StoreService } from './store.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('store')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Get('items')
  async getStoreItems() {
    return this.storeService.getStoreItems();
  }

  @Get('resources')
  async getMyResources(@Request() req: any) {
    return this.storeService.getUserResources(req.user.id);
  }

  @Post('buy')
  @Throttle({ short: { ttl: 5000, limit: 2 }, medium: { ttl: 60000, limit: 10 } })
  async buyResource(@Request() req: any, @Body() body: { resource: string; amount: number }) {
    return this.storeService.buyResource(req.user.id, body.resource, body.amount);
  }

  @Post('daily')
  @Throttle({ short: { ttl: 5000, limit: 1 }, medium: { ttl: 60000, limit: 3 } })
  async claimDailyCoins(@Request() req: any) {
    return this.storeService.claimDailyCoins(req.user.id);
  }

  @Get('daily')
  async getDailyStatus(@Request() req: any) {
    return this.storeService.getDailyStatus(req.user.id);
  }
}
