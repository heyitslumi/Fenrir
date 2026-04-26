import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OpenApiService } from './openapi.service.js';
import { OpenApiGuard } from './openapi.guard.js';

@Controller('openapi/v1')
@UseGuards(OpenApiGuard)
export class OpenApiController {
  constructor(private openApiService: OpenApiService) {}

  @Get('userinfo')
  async getUserInfo(@Query('id') id: string) {
    return this.openApiService.getUserInfo(id);
  }

  @Post('setcoins')
  @HttpCode(HttpStatus.OK)
  async setCoins(@Body() body: { id: string; coins: number }) {
    return this.openApiService.setCoins(body.id, body.coins);
  }

  @Post('addcoins')
  @HttpCode(HttpStatus.OK)
  async addCoins(@Body() body: { id: string; coins: number }) {
    return this.openApiService.addCoins(body.id, body.coins);
  }

  @Post('setresources')
  @HttpCode(HttpStatus.OK)
  async setResources(@Body() body: { id: string; ram?: number; disk?: number; cpu?: number; servers?: number }) {
    return this.openApiService.setResources(body.id, body);
  }

  @Post('addresources')
  @HttpCode(HttpStatus.OK)
  async addResources(@Body() body: { id: string; ram?: number; disk?: number; cpu?: number; servers?: number }) {
    return this.openApiService.addResources(body.id, body);
  }

  @Post('setplan')
  @HttpCode(HttpStatus.OK)
  async setPlan(@Body() body: { id: string; package?: string }) {
    return this.openApiService.setPackage(body.id, body.package ?? null);
  }

  @Post('ban')
  @HttpCode(HttpStatus.OK)
  async banUser(@Body() body: { id: string; reason?: string }) {
    return this.openApiService.banUser(body.id, body.reason);
  }

  @Post('unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(@Body() body: { id: string }) {
    return this.openApiService.unbanUser(body.id);
  }
}
