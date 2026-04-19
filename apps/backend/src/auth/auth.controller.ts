import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { ttl: 10000, limit: 1 }, medium: { ttl: 60000, limit: 3 }, long: { ttl: 3600000, limit: 10 } })
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    return this.authService.register(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 5000, limit: 3 }, medium: { ttl: 60000, limit: 10 }, long: { ttl: 3600000, limit: 30 } })
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const token = this.extractToken(req);
    return this.authService.logout(token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const token = this.extractToken(req);
    const user = await this.authService.validateToken(token);
    if (!user) {
      return { user: null };
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
    };
  }

  // ─── Passkey endpoints ───

  @Post('passkey/register/options')
  @UseGuards(JwtAuthGuard)
  async passkeyRegisterOptions(@Req() req: Request) {
    const user = await this.getUser(req);
    return this.authService.passkeyRegistrationOptions(user.id);
  }

  @Post('passkey/register/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async passkeyRegisterVerify(@Req() req: Request, @Body() body: any) {
    const user = await this.getUser(req);
    return this.authService.passkeyRegistrationVerify(user.id, body?.credential, body?.name);
  }

  @Post('passkey/authenticate/options')
  @HttpCode(HttpStatus.OK)
  async passkeyAuthOptions() {
    return this.authService.passkeyAuthenticationOptions();
  }

  @Post('passkey/authenticate/verify')
  @HttpCode(HttpStatus.OK)
  async passkeyAuthVerify(@Req() req: Request, @Body() body: any) {
    return this.authService.passkeyAuthenticationVerify(body?.challengeId, body?.credential, req.ip, req.headers['user-agent']);
  }

  @Get('passkeys')
  @UseGuards(JwtAuthGuard)
  async listPasskeys(@Req() req: Request) {
    const user = await this.getUser(req);
    return this.authService.listPasskeys(user.id);
  }

  @Delete('passkeys/:id')
  @UseGuards(JwtAuthGuard)
  async deletePasskey(@Req() req: Request, @Param('id') id: string) {
    const user = await this.getUser(req);
    return this.authService.deletePasskey(user.id, id);
  }

  // ─── Session endpoints ───

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(@Req() req: Request) {
    const user = await this.getUser(req);
    const token = this.extractToken(req);
    return this.authService.listSessions(user.id, token);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSession(@Req() req: Request, @Param('id') id: string) {
    const user = await this.getUser(req);
    const token = this.extractToken(req);
    return this.authService.deleteSession(user.id, id, token);
  }

  private async getUser(req: Request) {
    const token = this.extractToken(req);
    const user = await this.authService.validateToken(token);
    if (!user) throw new UnauthorizedException('Invalid session');
    return user;
  }

  private extractToken(req: Request): string {
    const authHeader = req.headers.authorization;
    return authHeader?.replace('Bearer ', '') || '';
  }
}
