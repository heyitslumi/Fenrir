import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { CalagopusService } from '../pelican/pelican.service.js';

@Injectable()
export class OAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private settings: SettingsService,
    private calagopus: CalagopusService,
  ) {}

  async getFrontendUrl(): Promise<string> {
    return (await this.settings.get('cors.origin')) || process.env.CORS_ORIGIN || 'http://localhost:3000';
  }

  async getCallbackUrl(provider: 'discord' | 'google' | 'github'): Promise<string> {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${backendUrl}/api/auth/oauth/${provider}/callback`;
  }

  private async findOrCreateUser(email: string, name: string, provider: string, providerId: string) {
    let user = await this.prisma.user.findUnique({ where: { email }, include: { role: true } });

    if (!user) {
      const userCount = await this.prisma.user.count();
      const isFirstUser = userCount === 0;
      let role = await this.prisma.role.findUnique({ where: { name: isFirstUser ? 'admin' : 'user' } });
      if (!role) {
        role = await this.prisma.role.create({
          data: { name: isFirstUser ? 'admin' : 'user', isDefault: !isFirstUser },
        });
      }

      user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: '',
          emailVerified: true,
          roleId: role.id,
        },
        include: { role: true },
      });

      // Create Calagopus user
      try {
        const calagopusUser = await this.calagopus.createUser({
          email: user.email,
          username: email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase().substring(0, 32),
          password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        });
        const cid = calagopusUser?.attributes?.uuid || calagopusUser?.attributes?.id?.toString();
        if (cid) await this.prisma.user.update({ where: { id: user.id }, data: { calagopusId: cid } });
      } catch { /* non-fatal */ }
    }

    return user;
  }

  private issueTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role?.name };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  // ─── Discord ──────────────────────────────────────────────────────────────

  async handleDiscord(code: string) {
    const config = await this.settings.getMany([
      'oauth.discord.clientId', 'oauth.discord.secret',
    ]);
    if (!config['oauth.discord.clientId'] || !config['oauth.discord.secret']) {
      throw new BadRequestException('Discord OAuth is not configured');
    }

    const callbackUrl = await this.getCallbackUrl('discord');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config['oauth.discord.clientId'],
        client_secret: config['oauth.discord.secret'],
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) throw new BadRequestException('Failed to exchange Discord code');
    const tokenData: any = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new BadRequestException('Failed to fetch Discord user');
    const discordUser: any = await userRes.json();

    if (!discordUser.email) throw new BadRequestException('Discord account has no email address');
    if (!discordUser.verified) throw new BadRequestException('Discord email is not verified');

    const user = await this.findOrCreateUser(discordUser.email, discordUser.global_name || discordUser.username, 'discord', discordUser.id);
    return this.issueTokens(user);
  }

  // ─── Google ───────────────────────────────────────────────────────────────

  async handleGoogle(code: string) {
    const config = await this.settings.getMany([
      'oauth.google.clientId', 'oauth.google.secret',
    ]);
    if (!config['oauth.google.clientId'] || !config['oauth.google.secret']) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const callbackUrl = await this.getCallbackUrl('google');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config['oauth.google.clientId'],
        client_secret: config['oauth.google.secret'],
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) throw new BadRequestException('Failed to exchange Google code');
    const tokenData: any = await tokenRes.json();

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new BadRequestException('Failed to fetch Google user');
    const googleUser: any = await userRes.json();

    if (!googleUser.email) throw new BadRequestException('Google account has no email address');

    const user = await this.findOrCreateUser(googleUser.email, googleUser.name || googleUser.email, 'google', googleUser.sub);
    return this.issueTokens(user);
  }

  // ─── GitHub ───────────────────────────────────────────────────────────────

  async handleGithub(code: string) {
    const config = await this.settings.getMany([
      'oauth.github.clientId', 'oauth.github.secret',
    ]);
    if (!config['oauth.github.clientId'] || !config['oauth.github.secret']) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config['oauth.github.clientId'],
        client_secret: config['oauth.github.secret'],
        code,
        redirect_uri: await this.getCallbackUrl('github'),
      }),
    });

    if (!tokenRes.ok) throw new BadRequestException('Failed to exchange GitHub code');
    const tokenData: any = await tokenRes.json();
    if (tokenData.error) throw new BadRequestException(tokenData.error_description || 'GitHub OAuth failed');

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
    });
    if (!userRes.ok) throw new BadRequestException('Failed to fetch GitHub user');
    const githubUser: any = await userRes.json();

    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
      });
      if (emailsRes.ok) {
        const emails: any[] = await emailsRes.json();
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary?.email;
      }
    }

    if (!email) throw new BadRequestException('GitHub account has no verified email address');

    const user = await this.findOrCreateUser(email, githubUser.name || githubUser.login, 'github', String(githubUser.id));
    return this.issueTokens(user);
  }
}
