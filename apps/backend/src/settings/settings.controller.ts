import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Param,
  Delete,
} from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // Public endpoint — no auth required
  @Get('brand')
  async getBrand() {
    return this.settingsService.getBrand();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAll() {
    const settings = await this.settingsService.getAll();
    // Mask the API key for security
    if (settings['panel.apiKey']) {
      settings['panel.apiKey'] = settings['panel.apiKey'].substring(0, 8) + '...';
    }
    return settings;
  }

  @Get('panel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getPanelConfig() {
    const config = await this.settingsService.getPanelConfig();
    if (config['panel.apiKey']) {
      config['panel.apiKey'] = config['panel.apiKey'].substring(0, 8) + '...';
    }
    return config;
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setMany(@Body() body: Record<string, string>) {
    await this.settingsService.setMany(body);
    return { message: 'Settings updated' };
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async set(@Param('key') key: string, @Body('value') value: string) {
    await this.settingsService.set(key, value);
    return { message: `Setting '${key}' updated` };
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('key') key: string) {
    await this.settingsService.delete(key);
    return { message: `Setting '${key}' deleted` };
  }
}
