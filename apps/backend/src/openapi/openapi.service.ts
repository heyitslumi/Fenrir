import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class OpenApiService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async getUserInfo(userId: string) {
    const resources = await this.prisma.userResources.findUnique({
      where: { userId },
      include: { package: true },
    });
    if (!resources) throw new NotFoundException(`User "${userId}" not found`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User "${userId}" not found`);

    const pkg = resources.package ?? { ram: 2048, disk: 3072, cpu: 100, servers: 2 };

    return {
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.roleId,
      },
      package: {
        name: resources.package?.name ?? 'default',
        ram: pkg.ram,
        disk: pkg.disk,
        cpu: pkg.cpu,
        servers: pkg.servers,
      },
      extra: {
        ram: resources.extraRam,
        disk: resources.extraDisk,
        cpu: resources.extraCpu,
        servers: resources.extraServers,
      },
      coins: resources.coins,
    };
  }

  async setCoins(userId: string, coins: number) {
    if (typeof coins !== 'number' || coins < 0 || coins > 999999999999999) {
      throw new BadRequestException('coins must be a number between 0 and 999999999999999');
    }

    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources) throw new NotFoundException(`User "${userId}" not found`);

    await this.prisma.userResources.update({
      where: { userId },
      data: { coins },
    });

    return { status: 'success', coins };
  }

  async addCoins(userId: string, coins: number) {
    if (typeof coins !== 'number' || coins < 1 || coins > 999999999999999) {
      throw new BadRequestException('coins must be a positive number');
    }

    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources) throw new NotFoundException(`User "${userId}" not found`);

    const updated = await this.prisma.userResources.update({
      where: { userId },
      data: { coins: { increment: coins } },
    });

    return { status: 'success', coins: updated.coins };
  }

  async setResources(userId: string, data: { ram?: number; disk?: number; cpu?: number; servers?: number }) {
    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources) throw new NotFoundException(`User "${userId}" not found`);

    const updateData: Record<string, number> = {};
    if (typeof data.ram === 'number') updateData.extraRam = data.ram;
    if (typeof data.disk === 'number') updateData.extraDisk = data.disk;
    if (typeof data.cpu === 'number') updateData.extraCpu = data.cpu;
    if (typeof data.servers === 'number') updateData.extraServers = data.servers;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Must provide at least one resource to set');
    }

    await this.prisma.userResources.update({
      where: { userId },
      data: updateData,
    });

    return { status: 'success', resources: updateData };
  }

  async setPackage(userId: string, packageName: string | null) {
    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources) throw new NotFoundException(`User "${userId}" not found`);

    if (packageName) {
      const pkg = await this.prisma.package.findFirst({ where: { name: packageName } });
      if (!pkg) throw new NotFoundException(`Package "${packageName}" not found`);

      await this.prisma.userResources.update({
        where: { userId },
        data: { packageId: pkg.id },
      });

      return { status: 'success', package: packageName };
    } else {
      const defaultPkg = await this.prisma.package.findFirst({ where: { isDefault: true } });
      await this.prisma.userResources.update({
        where: { userId },
        data: { packageId: defaultPkg?.id ?? null },
      });

      return { status: 'success', package: 'default' };
    }
  }

  async banUser(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User "${userId}" not found`);

    await this.settings.set(`ban.${userId}`, JSON.stringify({ reason: reason ?? 'Banned via API', bannedAt: new Date().toISOString() }));

    return { status: 'success', message: 'User banned' };
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User "${userId}" not found`);

    await this.settings.delete(`ban.${userId}`);

    return { status: 'success', message: 'User unbanned' };
  }

  async isUserBanned(userId: string): Promise<boolean> {
    const ban = await this.settings.get(`ban.${userId}`);
    return !!ban;
  }
}
