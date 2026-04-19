import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalagopusService } from '../pelican/pelican.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { randomUUID, randomBytes } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class AuthService {
  private challenges = new Map<string, { challenge: string; expires: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private calagopus: CalagopusService,
    private mailService: MailService,
    private settingsService: SettingsService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const userCount = await this.prisma.user.count();
    const isFirstUser = userCount === 0;

    let role = await this.prisma.role.findUnique({
      where: { name: isFirstUser ? 'admin' : 'user' },
    });

    if (!role) {
      role = await this.ensureDefaultRoles(isFirstUser ? 'admin' : 'user');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name || dto.email.split('@')[0],
        roleId: role.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    // Create account on Calagopus panel and link it
    let calagopusId: string | null = null;
    try {
      const username = (user.name || user.email.split('@')[0]).replace(/[^a-zA-Z0-9_.-]/g, '_');
      const calagopusUser = await this.calagopus.createUser({
        username,
        email: user.email,
        password: dto.password,
        external_id: user.id,
      });
      calagopusId = calagopusUser?.user?.uuid ?? calagopusUser?.uuid ?? null;
    } catch (err: any) {
      // Don't fail registration if Calagopus is unreachable — log and continue
      console.warn('Failed to create Calagopus account:', err.message);
    }

    // Create UserResources with calagopusId
    const defaultPkg = await this.prisma.package.findFirst({ where: { isDefault: true } });
    await this.prisma.userResources.create({
      data: {
        userId: user.id,
        packageId: defaultPkg?.id ?? null,
        calagopusId,
      },
    });

    // Email verification
    const emailVerifyEnabled = await this.settingsService.get('mail.verify_email');
    if (emailVerifyEnabled === 'true') {
      const emailToken = randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailToken },
      });
      await this.mailService.sendVerificationEmail(user.email, user.name || user.email, emailToken);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
      ...tokens,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({ where: { emailToken: token } });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailToken: null },
    });
    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role.name);
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, ipAddress, userAgent);

    // Send new login notification email
    this.mailService.sendNewLoginEmail(user.email, user.name || user.email, ipAddress, userAgent).catch(() => {});

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;
    const tokens = await this.generateTokens(user.id, user.email, user.role.name);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
      ...tokens,
    };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { token } });
    return { message: 'Logged out successfully' };
  }

  async validateToken(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    token: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.session.create({
      data: {
        userId,
        token,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private async ensureDefaultRoles(targetRole: string) {
    const adminRole = await this.prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
        isDefault: false,
      },
    });

    const userRole = await this.prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Default user role',
        isDefault: true,
      },
    });

    const defaultPermissions = [
      { name: 'dashboard.read', description: 'View dashboard' },
      { name: 'users.read', description: 'View users' },
      { name: 'users.write', description: 'Create and update users' },
      { name: 'users.delete', description: 'Delete users' },
      { name: 'roles.read', description: 'View roles' },
      { name: 'roles.write', description: 'Create and update roles' },
      { name: 'roles.delete', description: 'Delete roles' },
      { name: 'servers.read', description: 'View servers' },
      { name: 'servers.write', description: 'Create and update servers' },
      { name: 'servers.delete', description: 'Delete servers' },
      { name: 'settings.read', description: 'View settings' },
      { name: 'settings.write', description: 'Update settings' },
      { name: 'eggs.read', description: 'View eggs' },
      { name: 'eggs.write', description: 'Create and update eggs' },
      { name: 'packages.read', description: 'View packages' },
      { name: 'packages.write', description: 'Create and update packages' },
      { name: 'store.read', description: 'View store' },
      { name: 'store.write', description: 'Update store' },
    ];

    for (const perm of defaultPermissions) {
      const permission = await this.prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      });

      await this.prisma.rolePermission
        .create({
          data: { roleId: adminRole.id, permissionId: permission.id },
        })
        .catch(() => {});
    }

    const dashboardPerm = await this.prisma.permission.findUnique({
      where: { name: 'dashboard.read' },
    });
    if (dashboardPerm) {
      await this.prisma.rolePermission
        .create({
          data: { roleId: userRole.id, permissionId: dashboardPerm.id },
        })
        .catch(() => {});
    }

    return targetRole === 'admin' ? adminRole : userRole;
  }

  // ─── Passkey / WebAuthn ───

  private getRpInfo() {
    const rpId = process.env.WEBAUTHN_RP_ID || 'localhost';
    const rpName = process.env.WEBAUTHN_RP_NAME || 'Panel';
    const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpId}:3000`;
    return { rpId, rpName, origin };
  }

  async passkeyRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const { rpId, rpName } = this.getRpInfo();

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialId,
        type: 'public-key' as const,
        transports: pk.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    this.challenges.set(`reg:${userId}`, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    return options;
  }

  async passkeyRegistrationVerify(userId: string, body: any, name?: string) {
    const stored = this.challenges.get(`reg:${userId}`);
    if (!stored || stored.expires < Date.now()) {
      throw new BadRequestException('Registration challenge expired or missing');
    }
    this.challenges.delete(`reg:${userId}`);

    const { rpId, origin } = this.getRpInfo();

    console.log('[Passkey] Registration verify:', { rpId, origin, bodyKeys: body ? Object.keys(body) : 'null' });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: stored.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
      });
    } catch (err: any) {
      console.error('[Passkey] Registration verify error:', err.message);
      throw new BadRequestException(err.message || 'Passkey registration failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await this.prisma.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.transports ?? []) as string[],
        name: name || 'My Passkey',
      },
    });

    return { verified: true };
  }

  async passkeyAuthenticationOptions() {
    const { rpId } = this.getRpInfo();

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'preferred',
    });

    const challengeId = randomUUID();
    this.challenges.set(`auth:${challengeId}`, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    return { ...options, challengeId };
  }

  async passkeyAuthenticationVerify(challengeId: string, body: any, ipAddress?: string, userAgent?: string) {
    const stored = this.challenges.get(`auth:${challengeId}`);
    if (!stored || stored.expires < Date.now()) {
      throw new BadRequestException('Authentication challenge expired or missing');
    }
    this.challenges.delete(`auth:${challengeId}`);

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: body.id },
      include: {
        user: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!passkey) {
      throw new UnauthorizedException('Passkey not found');
    }

    const { rpId, origin } = this.getRpInfo();

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    const user = passkey.user;
    const tokens = await this.generateTokens(user.id, user.email, user.role.name);
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, ipAddress, userAgent);

    // Send new login notification email
    this.mailService.sendNewLoginEmail(user.email, user.name || user.email, ipAddress, userAgent).catch(() => {});

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role.name,
        permissions: user.role.permissions.map((rp) => rp.permission.name),
      },
      ...tokens,
    };
  }

  async listSessions(userId: string, currentToken: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, ipAddress: true, userAgent: true, createdAt: true, token: true },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      current: s.token === currentToken,
    }));
  }

  async deleteSession(userId: string, sessionId: string, currentToken: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.token === currentToken) {
      throw new BadRequestException('Cannot revoke your current session. Use logout instead.');
    }
    await this.prisma.session.delete({ where: { id: sessionId } });
    return { message: 'Session revoked' };
  }

  async listPasskeys(userId: string) {
    return this.prisma.passkey.findMany({
      where: { userId },
      select: { id: true, credentialId: true, name: true, deviceType: true, backedUp: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });
    if (!passkey) throw new NotFoundException('Passkey not found');
    await this.prisma.passkey.delete({ where: { id: passkeyId } });
    return { message: 'Passkey deleted' };
  }
}
