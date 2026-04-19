import {
  Controller,
  Get,
  Post,
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
import { MailService } from '../mail/mail.service.js';

@Controller('settings')
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private mailService: MailService,
  ) {}

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
    if (settings['openapi.key']) {
      settings['openapi.key'] = settings['openapi.key'].substring(0, 8) + '...';
    }
    if (settings['mail.pass']) {
      settings['mail.pass'] = '••••••••';
    }
    for (const key of ['oauth.discord.secret', 'oauth.google.secret', 'oauth.github.secret']) {
      if (settings[key]) settings[key] = '••••••••';
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
    const payload = { ...body };
    // Never overwrite secrets with masked placeholders
    if (payload['panel.apiKey']?.endsWith('...')) delete payload['panel.apiKey'];
    if (payload['openapi.key']?.endsWith('...')) delete payload['openapi.key'];
    if (payload['mail.pass'] === '••••••••' || payload['mail.pass'] === '********') delete payload['mail.pass'];
    for (const key of ['oauth.discord.secret', 'oauth.google.secret', 'oauth.github.secret']) {
      if (payload[key] === '••••••••') delete payload[key];
    }
    await this.settingsService.setMany(payload);
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

  @Post('test-email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async sendTestEmail(@Body('email') email: string) {
    if (!email) return { success: false, error: 'Email address is required' };
    return this.mailService.sendTestEmail(email);
  }
}
