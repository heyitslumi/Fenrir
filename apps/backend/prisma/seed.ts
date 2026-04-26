import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  console.log('🌱 Seeding database...');

  // ── Permissions ──
  const permissionNames = [
    'dashboard.read',
    'users.read', 'users.write', 'users.delete',
    'roles.read', 'roles.write', 'roles.delete',
    'servers.read', 'servers.write', 'servers.delete',
    'settings.read', 'settings.write',
    'eggs.read', 'eggs.write',
    'packages.read', 'packages.write',
    'store.read', 'store.write',
  ];

  for (const name of permissionNames) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: name.replace('.', ' ') },
    });
  }
  console.log(`  ✅ ${permissionNames.length} permissions`);

  // ── Roles ──
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Full admin access' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Regular user', isDefault: true },
  });
  console.log('  ✅ Roles: admin, user');

  // ── Assign all permissions to admin ──
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  console.log('  ✅ Admin role permissions assigned');

  // ── Default Package ──
  await prisma.package.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      ram: 2048,
      disk: 3072,
      cpu: 100,
      servers: 2,
      isDefault: true,
      sortOrder: 0,
    },
  });
  console.log('  ✅ Default package: Free');

  // ── Default Store Items ──
  const storeDefaults = [
    { resource: 'ram', cost: 100, per: 1024, limit: 16, enabled: true },
    { resource: 'disk', cost: 50, per: 1024, limit: 20, enabled: true },
    { resource: 'cpu', cost: 200, per: 100, limit: 4, enabled: true },
    { resource: 'servers', cost: 500, per: 1, limit: 2, enabled: true },
  ];

  for (const item of storeDefaults) {
    await prisma.storeItem.upsert({
      where: { resource: item.resource },
      update: {},
      create: item,
    });
  }
  console.log('  ✅ Store items: ram, disk, cpu, servers');

  // ── Default Settings ──
  const defaultSettings: Record<string, string> = {
    'panel.name': 'Game Panel',
    'panel.currency': 'coins',
    'daily.enabled': 'true',
    'daily.amount': '50',
    'ads.enabled': 'false',
    'ads.client': '',
    'ads.slot': '',
    'ads.layout': 'in-article',
    'ads.format': 'fluid',
    'openapi.enabled': 'true',
    'openapi.rate.short.limit': '5',
    'openapi.rate.short.ttl': '1',
    'openapi.rate.medium.limit': '100',
    'openapi.rate.medium.ttl': '60',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log('  ✅ Default settings');

  await prisma.$disconnect();
  console.log('✅ Seed complete!');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
