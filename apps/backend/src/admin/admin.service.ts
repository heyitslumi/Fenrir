import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalagopusService } from '../calagopus/calagopus.service.js';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private calagopus: CalagopusService,
  ) {}

  // ── Eggs ──

  async listEggs() {
    return this.prisma.egg.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }

  async createEgg(data: {
    name: string;
    displayName: string;
    category?: string;
    type?: string;
    logo?: string;
    enabled?: boolean;
    packageIds?: string[];
    free?: boolean;
    remoteUuid: string;
    nestUuid: string;
    dockerImage: string;
    startup: string;
    environment?: any;
    featureLimits?: any;
    minRam?: number;
    minDisk?: number;
    minCpu?: number;
    maxRam?: number;
    maxDisk?: number;
    maxCpu?: number;
    sortOrder?: number;
  }) {
    return this.prisma.egg.create({ data });
  }

  async updateEgg(id: string, data: Partial<{
    name: string;
    displayName: string;
    category: string;
    type: string;
    logo: string;
    enabled: boolean;
    packageIds: string[];
    free: boolean;
    remoteUuid: string;
    nestUuid: string;
    dockerImage: string;
    startup: string;
    environment: any;
    featureLimits: any;
    minRam: number;
    minDisk: number;
    minCpu: number;
    maxRam: number;
    maxDisk: number;
    maxCpu: number;
    sortOrder: number;
  }>) {
    const egg = await this.prisma.egg.findUnique({ where: { id } });
    if (!egg) throw new NotFoundException('Egg not found');
    return this.prisma.egg.update({ where: { id }, data });
  }

  async deleteEgg(id: string) {
    await this.prisma.egg.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Egg not found');
    });
    return { message: 'Egg deleted' };
  }

  // ── Locations ──

  async listLocations() {
    return this.prisma.location.findMany({ orderBy: { name: 'asc' } });
  }

  async createLocation(data: {
    remoteUuid: string;
    name: string;
    short: string;
    country?: string;
    flag?: string;
  }) {
    return this.prisma.location.create({ data });
  }

  async updateLocation(id: string, data: Partial<{
    remoteUuid: string;
    name: string;
    short: string;
    country: string;
    flag: string;
  }>) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return this.prisma.location.update({ where: { id }, data });
  }

  async deleteLocation(id: string) {
    await this.prisma.location.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Location not found');
    });
    return { message: 'Location deleted' };
  }

  // ── Packages ──

  async listPackages() {
    return this.prisma.package.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPackage(data: {
    name: string;
    ram?: number;
    disk?: number;
    cpu?: number;
    servers?: number;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    if (data.isDefault) {
      await this.prisma.package.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.package.create({ data });
  }

  async updatePackage(id: string, data: Partial<{
    name: string;
    ram: number;
    disk: number;
    cpu: number;
    servers: number;
    isDefault: boolean;
    sortOrder: number;
  }>) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (data.isDefault) {
      await this.prisma.package.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.package.update({ where: { id }, data });
  }

  async deletePackage(id: string) {
    await this.prisma.package.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Package not found');
    });
    return { message: 'Package deleted' };
  }

  // ── Store Items ──

  async listStoreItems() {
    return this.prisma.storeItem.findMany();
  }

  async upsertStoreItem(data: {
    resource: string;
    cost: number;
    per: number;
    limit: number;
    enabled?: boolean;
  }) {
    return this.prisma.storeItem.upsert({
      where: { resource: data.resource },
      update: { cost: data.cost, per: data.per, limit: data.limit, enabled: data.enabled ?? true },
      create: data,
    });
  }

  async deleteStoreItem(id: string) {
    await this.prisma.storeItem.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Store item not found');
    });
    return { message: 'Store item deleted' };
  }

  // ── User Resources (admin view) ──

  async getUserResources(userId: string) {
    return this.prisma.userResources.findUnique({
      where: { userId },
      include: { package: true, user: { select: { id: true, email: true, name: true } } },
    });
  }

  async updateUserResources(userId: string, data: Partial<{
    extraRam: number;
    extraDisk: number;
    extraCpu: number;
    extraServers: number;
    coins: number;
    packageId: string;
    calagopusId: string;
  }>) {
    return this.prisma.userResources.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  // ── Sync from Calagopus ──

  async syncLocations() {
    const remote = await this.calagopus.fetchAll<any>('/api/admin/locations', 'locations');
    let created = 0, updated = 0;
    for (const loc of remote) {
      const existing = await this.prisma.location.findUnique({ where: { remoteUuid: loc.uuid } });
      if (existing) {
        await this.prisma.location.update({
          where: { remoteUuid: loc.uuid },
          data: { name: loc.name ?? existing.name, short: loc.short ?? existing.short },
        });
        updated++;
      } else {
        await this.prisma.location.create({
          data: {
            remoteUuid: loc.uuid,
            name: loc.name ?? 'Unknown',
            short: loc.short ?? loc.name ?? 'unk',
          },
        });
        created++;
      }
    }
    return { synced: remote.length, created, updated };
  }

  async syncNodes() {
    const remote = await this.calagopus.fetchAll<any>('/api/admin/nodes', 'nodes');
    let created = 0, updated = 0;
    for (const node of remote) {
      const existing = await this.prisma.node.findUnique({ where: { remoteUuid: node.uuid } });
      const data = {
        name: node.name ?? 'Unknown',
        fqdn: node.fqdn ?? node.name ?? '',
        memory: node.memory ?? node.limits?.memory ?? 0,
        disk: node.disk ?? node.limits?.disk ?? 0,
        locationUuid: node.location?.uuid ?? node.location_uuid ?? null,
      };
      if (existing) {
        await this.prisma.node.update({ where: { remoteUuid: node.uuid }, data });
        updated++;
      } else {
        await this.prisma.node.create({ data: { remoteUuid: node.uuid, ...data } });
        created++;
      }
    }
    return { synced: remote.length, created, updated };
  }

  async syncNestsAndEggs() {
    const nests = await this.calagopus.fetchAll<any>('/api/admin/nests', 'nests');
    let created = 0, updated = 0, totalEggs = 0;
    for (const nest of nests) {
      const eggsList = await this.calagopus.fetchAll<any>(`/api/admin/nests/${nest.uuid}/eggs`, 'eggs');
      for (const eggSummary of eggsList) {
        totalEggs++;

        // Fetch full egg detail and variables
        let egg = eggSummary;
        try {
          const detail = await this.calagopus.getEgg(nest.uuid, eggSummary.uuid);
          egg = detail?.egg ?? detail ?? eggSummary;
          console.log(`[syncEggs] Raw egg keys for ${egg.name ?? eggSummary.uuid}:`, Object.keys(egg).join(', '));
          // Variables might be in relationships.variables or directly on egg
          if (!egg.variables && egg.relationships?.variables) {
            egg.variables = egg.relationships.variables.data ?? egg.relationships.variables;
          }
        } catch (err: any) {
          console.warn(`[syncEggs] Could not fetch detail for egg ${eggSummary.uuid}:`, err.message);
        }

        // If variables still empty, try dedicated variables endpoint
        if (!Array.isArray(egg.variables) || egg.variables.length === 0) {
          try {
            const varsRes = await this.calagopus.getEggVariables(nest.uuid, eggSummary.uuid);
            const vars = varsRes?.data ?? varsRes?.variables?.data ?? varsRes?.variables ?? varsRes;
            if (Array.isArray(vars)) {
              egg.variables = vars;
            }
          } catch {
            // Variables endpoint may not exist
          }
        }
        console.log(`[syncEggs] Egg ${egg.name}: ${Array.isArray(egg.variables) ? egg.variables.length : 0} variables, keys:`, Array.isArray(egg.variables) ? egg.variables.map((v: any) => v.env_variable || v.name).join(', ') : 'none');

        const existing = await this.prisma.egg.findUnique({ where: { remoteUuid: egg.uuid } });

        // Build environment: store full variable metadata for the frontend
        // Each variable has: env_variable, name, description, default_value, user_viewable, user_editable, rules
        const envVars: Array<{
          env_variable: string;
          name: string;
          description: string;
          default_value: string;
          user_viewable: boolean;
          user_editable: boolean;
          rules: string;
        }> = [];
        if (Array.isArray(egg.variables)) {
          for (const v of egg.variables) {
            envVars.push({
              env_variable: v.env_variable ?? '',
              name: v.name ?? v.env_variable ?? '',
              description: v.description ?? '',
              default_value: v.default_value ?? '',
              user_viewable: v.user_viewable ?? true,
              user_editable: v.user_editable ?? false,
              rules: v.rules ?? '',
            });
          }
        }

        // Docker images: Pelican stores as { "Label": "ghcr.io/image:tag" }
        // Normalize to { label: string, image: string }[] and pick default
        let dockerImage = '';
        let dockerImagesMap: Record<string, string> = {};
        if (egg.docker_images && typeof egg.docker_images === 'object' && !Array.isArray(egg.docker_images)) {
          // { "Java 8": "ghcr.io/...", "Java 11": "ghcr.io/..." }
          dockerImagesMap = egg.docker_images;
          const entries = Object.entries(egg.docker_images);
          if (entries.length > 0) {
            const [label, uri] = entries[0];
            // Value is the URI if it contains / or :
            if (typeof uri === 'string' && (uri.includes('/') || uri.includes(':'))) {
              dockerImage = uri;
            } else {
              dockerImage = label;
            }
          }
        } else if (typeof egg.docker_image === 'string' && egg.docker_image) {
          dockerImage = egg.docker_image;
          dockerImagesMap = { 'Default': egg.docker_image };
        }

        const featureLimits = egg.feature_limits && Object.keys(egg.feature_limits).length > 0
          ? egg.feature_limits
          : { allocations: 1, databases: 0, backups: 0, schedules: 0 };

        const data = {
          displayName: egg.name ?? 'Unknown',
          nestUuid: nest.uuid,
          dockerImage,
          dockerImages: dockerImagesMap,
          startup: egg.startup ?? '',
          environment: envVars,
          featureLimits,
        };
        if (existing) {
          await this.prisma.egg.update({ where: { remoteUuid: egg.uuid }, data });
          updated++;
        } else {
          const slug = (egg.name ?? 'egg').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          let name = slug;
          let suffix = 0;
          while (await this.prisma.egg.findUnique({ where: { name } })) {
            suffix++;
            name = `${slug}-${suffix}`;
          }
          await this.prisma.egg.create({
            data: {
              name,
              remoteUuid: egg.uuid,
              category: nest.name ?? 'General',
              ...data,
            },
          });
          created++;
        }
      }
    }
    return { nests: nests.length, eggs: totalEggs, created, updated };
  }

  async syncAll() {
    try {
      const [locations, nodes, eggs] = await Promise.all([
        this.syncLocations(),
        this.syncNodes(),
        this.syncNestsAndEggs(),
      ]);
      return { locations, nodes, eggs };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Sync failed');
    }
  }

  // ── Nodes (read) ──

  async listNodes() {
    return this.prisma.node.findMany({ orderBy: { name: 'asc' } });
  }

  // ── Roles ──

  async listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(data: { name: string; description?: string; permissions?: string[] }) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('Role name already exists');

    const role = await this.prisma.role.create({
      data: { name: data.name, description: data.description },
    });

    if (data.permissions?.length) {
      await this.setRolePermissions(role.id, data.permissions);
    }

    return this.getRole(role.id);
  }

  async updateRole(id: string, data: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
      if (existing) throw new BadRequestException('Role name already exists');
    }

    await this.prisma.role.update({
      where: { id },
      data: { name: data.name, description: data.description },
    });

    if (data.permissions !== undefined) {
      await this.setRolePermissions(id, data.permissions);
    }

    return this.getRole(id);
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    if (role._count.users > 0) throw new BadRequestException('Cannot delete a role with assigned users');
    if (role.isDefault) throw new BadRequestException('Cannot delete the default role');
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }

  private async setRolePermissions(roleId: string, permissionNames: string[]) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });

    for (const name of permissionNames) {
      let perm = await this.prisma.permission.findUnique({ where: { name } });
      if (!perm) {
        perm = await this.prisma.permission.create({ data: { name, description: name } });
      }
      await this.prisma.rolePermission.create({
        data: { roleId, permissionId: perm.id },
      });
    }
  }

  // ── Permissions (list all known) ──

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }

  // ── User detail (admin) ──

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        resources: { include: { package: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    let servers: any[] = [];
    if (user.resources?.calagopusId) {
      try {
        const res = await this.calagopus.getUserServers(user.resources.calagopusId);
        servers = (res?.servers?.data ?? []).map((s: any) => ({
          uuid: s.uuid,
          name: s.name,
          status: s.status,
          suspended: s.is_suspended,
          limits: s.limits,
          node: s.node,
        }));
      } catch { /* ignore */ }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      role: user.role.name,
      roleId: user.roleId,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      resources: user.resources,
      servers,
      createdAt: user.createdAt,
    };
  }

  async setUserCoins(userId: string, coins: number) {
    if (coins < 0) throw new BadRequestException('Coins cannot be negative');
    return this.prisma.userResources.upsert({
      where: { userId },
      update: { coins },
      create: { userId, coins },
    });
  }

  async addUserCoins(userId: string, coins: number) {
    if (coins === 0) throw new BadRequestException('Coins delta cannot be 0');
    return this.prisma.userResources.upsert({
      where: { userId },
      update: { coins: { increment: coins } },
      create: { userId, coins: Math.max(coins, 0) },
    });
  }

  async setUserPackage(userId: string, packageId: string | null) {
    return this.prisma.userResources.upsert({
      where: { userId },
      update: { packageId },
      create: { userId, packageId },
    });
  }

  async setUserRole(userId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    return this.prisma.user.update({ where: { id: userId }, data: { roleId } });
  }

  async forceVerifyEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailToken: null },
    });
    return { message: 'Email verified' };
  }

  // ── Server management (admin) ──

  async listAllServers(page = 1, perPage = 50) {
    const offset = (page - 1) * perPage;
    const [dbServers, total] = await Promise.all([
      this.prisma.server.findMany({ skip: offset, take: perPage, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, name: true } } } }),
      this.prisma.server.count(),
    ]);
    const servers: any[] = [];
    for (const db of dbServers) {
      try {
        const res = await this.calagopus.getServer(db.uuid);
        const s = res?.server ?? res;
        if (s) servers.push({ ...s, _owner: db.user });
      } catch { servers.push({ uuid: db.uuid, name: '(unavailable)', _owner: db.user }); }
    }
    return { servers: { data: servers, total, page, perPage } };
  }

  async migrateServers() {
    // Fetch all servers from Calagopus panel
    const allServers = await this.calagopus.fetchAll<any>('/api/admin/servers', 'servers');

    // Build a map of calagopusId → local userId
    const allResources = await this.prisma.userResources.findMany({
      where: { calagopusId: { not: null } },
      select: { userId: true, calagopusId: true },
    });
    const cidToUserId = new Map(allResources.map((r) => [r.calagopusId!, r.userId]));

    let imported = 0, skipped = 0, unmatched = 0;
    for (const s of allServers) {
      const serverUuid = s.uuid;
      if (!serverUuid) continue;

      // Skip if already tracked
      const existing = await this.prisma.server.findUnique({ where: { uuid: serverUuid } });
      if (existing) { skipped++; continue; }

      // Match owner via calagopusId
      const ownerCid = s.owner?.uuid ?? s.owner_uuid ?? null;
      const userId = ownerCid ? cidToUserId.get(ownerCid) : null;
      if (!userId) { unmatched++; continue; }

      await this.prisma.server.create({ data: { uuid: serverUuid, userId } });
      imported++;
    }

    return { total: allServers.length, imported, skipped, unmatched };
  }

  async suspendServer(uuid: string) {
    await this.calagopus.suspendServer(uuid);
    return { message: 'Server suspended' };
  }

  async unsuspendServer(uuid: string) {
    await this.calagopus.unsuspendServer(uuid);
    return { message: 'Server unsuspended' };
  }

  async deleteServer(uuid: string) {
    await this.calagopus.deleteServer(uuid);
    return { message: 'Server deleted' };
  }

  async getServer(uuid: string) {
    return this.calagopus.getServer(uuid);
  }

  async updateServer(uuid: string, data: any) {
    return this.calagopus.updateServer(uuid, data);
  }

  async listNodeAllocations(nodeUuid: string) {
    const res = await this.calagopus.listNodeAllocationsByUuid(nodeUuid);
    return res?.data ?? res?.allocations?.data ?? [];
  }
}
