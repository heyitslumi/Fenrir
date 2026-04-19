import { Controller, Get, Post, Delete, Query, Req, Res, HttpStatus, UseGuards, Param } from '@nestjs/common';
import type { Response, Request } from 'express';
import { SettingsService } from '../settings/settings.service.js';
import { OAuthService } from './oauth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtService } from '@nestjs/jwt';

@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private settings: SettingsService,
    private oauthService: OAuthService,
    private jwtService: JwtService,
  ) {}

  private extractToken(req: Request): string {
    const auth = req.headers['authorization'];
    if (!auth) return '';
    return auth.replace('Bearer ', '');
  }

  private async getUser(req: Request) {
    const token = this.extractToken(req);
    const payload: any = this.jwtService.verify(token);
    return { id: payload.sub, email: payload.email };
  }

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
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
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
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
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
      return res.redirect(`${await this.oauthService.getFrontendUrl()}/oauth/success?token=${accessToken}&refresh=${refreshToken}`);
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

  // ─── Link redirect endpoints (redirect with ?link=1 to distinguish) ────────

  @Get('discord/link')
  async discordLinkRedirect(@Query('state') state: string, @Res() res: Response) {
    const config = await this.settings.getMany(['oauth.discord.enabled', 'oauth.discord.clientId']);
    if (config['oauth.discord.enabled'] !== 'true' || !config['oauth.discord.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Discord OAuth is not configured' });
    }
    const callbackUrl = (await this.oauthService.getCallbackUrl('discord')).replace('/callback', '/link/callback');
    const url = `https://discord.com/oauth2/authorize?client_id=${config['oauth.discord.clientId']}&response_type=code&scope=identify+email&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state || '')}`;
    return res.redirect(url);
  }

  @Get('google/link')
  async googleLinkRedirect(@Query('state') state: string, @Res() res: Response) {
    const config = await this.settings.getMany(['oauth.google.enabled', 'oauth.google.clientId']);
    if (config['oauth.google.enabled'] !== 'true' || !config['oauth.google.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Google OAuth is not configured' });
    }
    const callbackUrl = (await this.oauthService.getCallbackUrl('google')).replace('/callback', '/link/callback');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config['oauth.google.clientId']}&response_type=code&scope=openid+email+profile&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state || '')}`;
    return res.redirect(url);
  }

  @Get('github/link')
  async githubLinkRedirect(@Query('state') state: string, @Res() res: Response) {
    const config = await this.settings.getMany(['oauth.github.enabled', 'oauth.github.clientId']);
    if (config['oauth.github.enabled'] !== 'true' || !config['oauth.github.clientId']) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'GitHub OAuth is not configured' });
    }
    const callbackUrl = (await this.oauthService.getCallbackUrl('github')).replace('/callback', '/link/callback');
    const url = `https://github.com/login/oauth/authorize?client_id=${config['oauth.github.clientId']}&scope=user:email&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state || '')}`;
    return res.redirect(url);
  }

  // ─── Link callbacks (use state cookie pattern via token in URL) ────────────

  @Get('discord/link/callback')
  async discordLinkCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = await this.oauthService.getFrontendUrl();
    try {
      const userId = state;
      await this.oauthService.handleDiscordLink(userId, code);
      return res.redirect(`${frontendUrl}/profile?linked=discord`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/profile?link_error=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('google/link/callback')
  async googleLinkCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = await this.oauthService.getFrontendUrl();
    try {
      await this.oauthService.handleGoogleLink(state, code);
      return res.redirect(`${frontendUrl}/profile?linked=google`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/profile?link_error=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('github/link/callback')
  async githubLinkCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = await this.oauthService.getFrontendUrl();
    try {
      await this.oauthService.handleGithubLink(state, code);
      return res.redirect(`${frontendUrl}/profile?linked=github`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/profile?link_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Linked accounts management ────────────────────────────────────────────

  @Get('linked')
  @UseGuards(JwtAuthGuard)
  async getLinked(@Req() req: Request) {
    const user = await this.getUser(req);
    return this.oauthService.getLinkedAccounts(user.id);
  }

  @Delete('linked/:provider')
  @UseGuards(JwtAuthGuard)
  async unlink(@Req() req: Request, @Param('provider') provider: string) {
    const user = await this.getUser(req);
    await this.oauthService.unlinkAccount(user.id, provider);
    return { message: `${provider} unlinked` };
  }
}
