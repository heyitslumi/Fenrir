import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class OpenApiGuard implements CanActivate {
  private static buckets = new Map<string, { count: number; resetAt: number }>();

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

    await this.enforceRateLimit(request);
    return true;
  }

  private async enforceRateLimit(request: any) {
    const now = Date.now();
    const ip = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown';
    const route = request.path ?? request.url ?? 'openapi';

    const shortLimit = parseInt((await this.settings.get('openapi.rate.short.limit')) ?? '5', 10);
    const shortTtl = parseInt((await this.settings.get('openapi.rate.short.ttl')) ?? '1', 10);
    const mediumLimit = parseInt((await this.settings.get('openapi.rate.medium.limit')) ?? '100', 10);
    const mediumTtl = parseInt((await this.settings.get('openapi.rate.medium.ttl')) ?? '60', 10);

    this.assertWindow(`${ip}:${route}:short`, shortLimit, shortTtl, now, 'OpenAPI short rate limit exceeded');
    this.assertWindow(`${ip}:${route}:medium`, mediumLimit, mediumTtl, now, 'OpenAPI medium rate limit exceeded');
  }

  private assertWindow(bucketKey: string, limit: number, ttlSeconds: number, nowMs: number, message: string) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
    const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 1;
    const ttlMs = safeTtl * 1000;

    const bucket = OpenApiGuard.buckets.get(bucketKey);
    if (!bucket || nowMs >= bucket.resetAt) {
      OpenApiGuard.buckets.set(bucketKey, { count: 1, resetAt: nowMs + ttlMs });
      return;
    }

    if (bucket.count >= safeLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    OpenApiGuard.buckets.set(bucketKey, bucket);
  }
}
