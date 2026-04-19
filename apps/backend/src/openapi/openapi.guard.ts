import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class OpenApiGuard implements CanActivate {
  constructor(private settings: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers['authorization'];

    if (!auth) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const apiKey = await this.settings.get('openapi.key');
    if (!apiKey) {
      throw new UnauthorizedException('OpenAPI is not configured. Set openapi.key in admin settings.');
    }

    const enabled = await this.settings.get('openapi.enabled');
    if (enabled === 'false') {
      throw new UnauthorizedException('OpenAPI is disabled');
    }

    if (auth !== `Bearer ${apiKey}`) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
