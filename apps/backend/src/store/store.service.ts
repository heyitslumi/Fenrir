import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class StoreService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async getStoreItems() {
    return this.prisma.storeItem.findMany({ where: { enabled: true } });
  }

  async getUserResources(userId: string) {
    let resources = await this.prisma.userResources.findUnique({
      where: { userId },
      include: { package: true },
    });
    if (!resources) {
      const defaultPkg = await this.prisma.package.findFirst({ where: { isDefault: true } });
      resources = await this.prisma.userResources.create({
        data: { userId, packageId: defaultPkg?.id ?? null },
        include: { package: true },
      });
    }
    return resources;
  }

  async buyResource(userId: string, resource: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const item = await this.prisma.storeItem.findUnique({ where: { resource } });
    if (!item || !item.enabled) throw new NotFoundException(`Store item "${resource}" not available`);

    const totalCost = item.cost * amount;
    const resources = await this.getUserResources(userId);

    if (resources.coins < totalCost) {
      throw new BadRequestException(`Not enough coins. Need ${totalCost}, have ${resources.coins}`);
    }

    const totalPer = item.per * amount;

    const updateData: Record<string, any> = { coins: { decrement: totalCost } };
    switch (resource) {
      case 'ram':
        if (resources.extraRam + totalPer > item.limit * item.per)
          throw new BadRequestException(`Max extra RAM: ${item.limit * item.per} MB`);
        updateData.extraRam = { increment: totalPer };
        break;
      case 'disk':
        if (resources.extraDisk + totalPer > item.limit * item.per)
          throw new BadRequestException(`Max extra disk: ${item.limit * item.per} MB`);
        updateData.extraDisk = { increment: totalPer };
        break;
      case 'cpu':
        if (resources.extraCpu + totalPer > item.limit * item.per)
          throw new BadRequestException(`Max extra CPU: ${item.limit * item.per}%`);
        updateData.extraCpu = { increment: totalPer };
        break;
      case 'servers':
        if (resources.extraServers + totalPer > item.limit * item.per)
          throw new BadRequestException(`Max extra servers: ${item.limit * item.per}`);
        updateData.extraServers = { increment: totalPer };
        break;
      default:
        throw new BadRequestException(`Unknown resource: ${resource}`);
    }

    await this.prisma.userResources.update({
      where: { userId },
      data: updateData,
    });

    return { success: true, spent: totalCost, resource, amount: totalPer };
  }

  async claimDailyCoins(userId: string) {
    const dailyEnabled = await this.settings.get('daily.enabled');
    if (dailyEnabled !== 'true') throw new BadRequestException('Daily coins disabled');

    const dailyAmount = parseFloat(await this.settings.get('daily.amount') ?? '50');
    const resources = await this.getUserResources(userId);

    if (resources.lastDailyClaim) {
      const now = new Date();
      const lastClaim = new Date(resources.lastDailyClaim);
      const hoursDiff = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        const hoursLeft = Math.ceil(24 - hoursDiff);
        throw new BadRequestException(`Come back in ${hoursLeft} hour(s)`);
      }
    }

    await this.prisma.userResources.update({
      where: { userId },
      data: {
        coins: { increment: dailyAmount },
        lastDailyClaim: new Date(),
      },
    });

    return { success: true, amount: dailyAmount };
  }

  async getDailyStatus(userId: string) {
    const dailyEnabled = await this.settings.get('daily.enabled');
    if (dailyEnabled !== 'true') return { available: false, reason: 'disabled' };

    const resources = await this.getUserResources(userId);
    if (!resources.lastDailyClaim) return { available: true };

    const now = new Date();
    const lastClaim = new Date(resources.lastDailyClaim);
    const hoursDiff = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
    if (hoursDiff >= 24) return { available: true };

    return { available: false, hoursLeft: Math.ceil(24 - hoursDiff) };
  }
}
