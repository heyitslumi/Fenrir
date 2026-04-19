import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: InstanceType<typeof PrismaClient>;

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.client = new PrismaClient({ adapter });
  }

  get user() { return this.client.user; }
  get role() { return this.client.role; }
  get permission() { return this.client.permission; }
  get rolePermission() { return this.client.rolePermission; }
  get session() { return this.client.session; }
  get setting() { return this.client.setting; }
  get egg() { return this.client.egg; }
  get location() { return this.client.location; }
  get package() { return this.client.package; }
  get userResources() { return this.client.userResources; }
  get node() { return this.client.node; }
  get storeItem() { return this.client.storeItem; }
  get passkey() { return this.client.passkey; }
  get oAuthAccount() { return this.client.oAuthAccount; }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
