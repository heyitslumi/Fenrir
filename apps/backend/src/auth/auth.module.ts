import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { CalagopusModule } from '../pelican/pelican.module.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'panel-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    CalagopusModule,
    SettingsModule,
  ],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, OAuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
