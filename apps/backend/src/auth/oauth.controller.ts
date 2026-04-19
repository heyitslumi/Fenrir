import { Controller, Get, Query, Redirect, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { SettingsService } from '../settings/settings.service.js';
import { OAuthService } from './oauth.service.js';

@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private settings: SettingsService,
    private oauthService: OAuthService,
  ) {}

  // ─── Discord ──────────────────────────────────────────────────────────────

  @Get('discord')
  async discordRedirect(@Res() res: Response) {
    const config = await this.settings.getMany(['oauth.discord.enabled', 'oauth.discord.clientId']);
    if (config['oauth.discord.enabled'] !== 'true' || !config['oauth.discord.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Discord OAuth is not configured' });
    }
    const url = `https://discord.com/oauth2/authorize?client_id=${config['oauth.discord.clientId']}&response_type=code&scope=identify+email&redirect_uri=${encodeURIComponent(await this.oauthService.getCallbackUrl('discord'))}`;
    return res.redirect(url);
  }

  @Get('discord/callback')
  async discordCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.oauthService.handleDiscord(code);
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
    } catch (err: any) {
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Google ───────────────────────────────────────────────────────────────

  @Get('google')
  async googleRedirect(@Res() res: Response) {
    const config = await this.settings.getMany(['oauth.google.enabled', 'oauth.google.clientId']);
    if (config['oauth.google.enabled'] !== 'true' || !config['oauth.google.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Google OAuth is not configured' });
    }
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config['oauth.google.clientId']}&response_type=code&scope=openid+email+profile&redirect_uri=${encodeURIComponent(await this.oauthService.getCallbackUrl('google'))}`;
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.oauthService.handleGoogle(code);
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
    } catch (err: any) {
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── GitHub ───────────────────────────────────────────────────────────────

  @Get('github')
  async githubRedirect(@Res() res: Response) {
    const config = await this.settings.getMany(['oauth.github.enabled', 'oauth.github.clientId']);
    if (config['oauth.github.enabled'] !== 'true' || !config['oauth.github.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'GitHub OAuth is not configured' });
    }
    const url = `https://github.com/login/oauth/authorize?client_id=${config['oauth.github.clientId']}&scope=user:email&redirect_uri=${encodeURIComponent(await this.oauthService.getCallbackUrl('github'))}`;
    return res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.oauthService.handleGithub(code);
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
    } catch (err: any) {
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/authentication/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Config endpoint (public, for frontend to show/hide buttons) ──────────

  @Get('config')
  async getConfig() {
    const config = await this.settings.getMany([
      'oauth.discord.enabled', 'oauth.discord.clientId',
      'oauth.google.enabled', 'oauth.google.clientId',
      'oauth.github.enabled', 'oauth.github.clientId',
    ]);
    return {
      discord: config['oauth.discord.enabled'] === 'true' && !!config['oauth.discord.clientId'],
      google: config['oauth.google.enabled'] === 'true' && !!config['oauth.google.clientId'],
      github: config['oauth.github.enabled'] === 'true' && !!config['oauth.github.clientId'],
    };
  }
}
