import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    const ops = Object.entries(entries).map(([key, value]) =>
      this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );
    await Promise.all(ops);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.setting.delete({ where: { key } }).catch(() => {});
  }

  async getPanelConfig() {
    const keys = ['panel.url', 'panel.apiKey', 'panel.name', 'panel.currency', 'daily.enabled', 'daily.amount'];
    return this.getMany(keys);
  }

  async getBrand() {
    return this.getMany(['panel.name', 'panel.logo', 'panel.logoHeight']);
  }
}
