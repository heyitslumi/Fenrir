import { Injectable, ForbiddenException, BadRequestException, NotFoundException, ConflictException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalagopusService } from '../calagopus/calagopus.service.js';

@Injectable()
export class ServersService {
  // Per-user mutex locks to prevent race conditions on resource checks
  private userLocks = new Map<string, Promise<any>>();
  // Track active creation jobs per user for queue visibility
  private creationQueue = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private calagopus: CalagopusService,
  ) {}

  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    // Chain onto any existing lock for this user — serializes requests
    const prev = this.userLocks.get(userId) ?? Promise.resolve();
    const current = prev.then(fn, fn); // run fn even if prev rejected
    this.userLocks.set(userId, current);
    try {
      return await current;
    } finally {
      // Clean up if this is still the latest in the chain
      if (this.userLocks.get(userId) === current) {
        this.userLocks.delete(userId);
      }
    }
  }

  private async getUserResources(userId: string) {
    let resources = await this.prisma.userResources.findUnique({
      where: { userId },
      include: { package: true },
    });
    if (!resources) {
      const defaultPkg = await this.prisma.package.findFirst({ where: { isDefault: true } });
      resources = await this.prisma.userResources.create({
        data: {
          userId,
          packageId: defaultPkg?.id ?? null,
        },
        include: { package: true },
      });
    }
    return resources;
  }

  private getPkgDefaults() {
    return { ram: 2048, disk: 3072, cpu: 100, servers: 2 };
  }

  private parseEggPackageIds(value: unknown): string[] {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }

  async listUserServers(userId: string) {
    const resources = await this.getUserResources(userId);

    // Only show servers tracked in our DB (created through this panel)
    const dbServers = await this.prisma.server.findMany({ where: { userId } });
    if (dbServers.length === 0) {
      return { servers: [], resources: this.computeAvailableResources(resources, []) };
    }

    // Fetch details for each tracked server from Calagopus
    const servers: any[] = [];
    for (const dbServer of dbServers) {
      try {
        const res = await this.calagopus.clientGetServer(dbServer.uuid);
        const s = res?.server ?? res;
        if (s) {
          servers.push({
            uuid: s.uuid ?? dbServer.uuid,
            uuidShort: s.uuid_short,
            name: s.name,
            description: s.description,
            status: s.status,
            suspended: s.is_suspended,
            limits: s.limits,
            featureLimits: s.feature_limits,
            egg: s.egg,
            node: s.node,
            allocation: s.allocation,
          });
        }
      } catch { /* server may have been deleted externally — skip */ }
    }

    return {
      servers,
      resources: this.computeAvailableResources(resources, servers),
    };
  }

  private computeAvailableResources(resources: any, servers: any[]) {
    const pkg = resources.package ?? this.getPkgDefaults();
    const totalRam = pkg.ram + (resources.extraRam || 0);
    const totalDisk = pkg.disk + (resources.extraDisk || 0);
    const totalCpu = pkg.cpu + (resources.extraCpu || 0);
    const totalServers = pkg.servers + (resources.extraServers || 0);

    let usedRam = 0, usedDisk = 0, usedCpu = 0;
    for (const s of servers) {
      const limits = s.limits ?? {};
      usedRam += limits.memory ?? 0;
      usedDisk += limits.disk ?? 0;
      usedCpu += limits.cpu ?? 0;
    }

    return {
      total: { ram: totalRam, disk: totalDisk, cpu: totalCpu, servers: totalServers },
      used: { ram: usedRam, disk: usedDisk, cpu: usedCpu, servers: servers.length },
      available: {
        ram: totalRam - usedRam,
        disk: totalDisk - usedDisk,
        cpu: totalCpu - usedCpu,
        servers: totalServers - servers.length,
      },
      packageId: resources.packageId ?? null,
      coins: resources.coins ?? 0,
    };
  }

  async createServer(userId: string, data: {
    name: string;
    ram: number;
    disk: number;
    cpu: number;
    egg: string;
    location: string;
    environment?: Record<string, string>;
    dockerImage?: string;
  }) {
    // Check queue depth — reject if user already has too many pending creations
    const pending = this.creationQueue.get(userId) ?? 0;
    if (pending >= 2) {
      throw new ConflictException('You already have server creations in progress. Please wait.');
    }

    return this.withUserLock(userId, async () => {
      this.creationQueue.set(userId, (this.creationQueue.get(userId) ?? 0) + 1);
      try {
        return await this._createServerInner(userId, data);
      } finally {
        const count = (this.creationQueue.get(userId) ?? 1) - 1;
        if (count <= 0) this.creationQueue.delete(userId);
        else this.creationQueue.set(userId, count);
      }
    });
  }

  private async _createServerInner(userId: string, data: {
    name: string;
    ram: number;
    disk: number;
    cpu: number;
    egg: string;
    location: string;
    environment?: Record<string, string>;
    dockerImage?: string;
  }) {
    const trimmedName = data.name?.trim() ?? '';
    if (trimmedName.length < 3) throw new BadRequestException('Server name must be at least 3 characters.');
    if (trimmedName.length > 64) throw new BadRequestException('Server name must be at most 64 characters.');
    data.name = trimmedName;

    let resources = await this.getUserResources(userId);
    if (!resources.calagopusId) {
      throw new BadRequestException('No Calagopus account linked. Contact admin.');
    }

    // Ensure panel user is valid — re-create if missing or stale
    resources = await this.ensurePanelUser(userId, resources);

    // Fetch egg config from DB (support lookup by id, name, or remoteUuid)
    let eggConfig = await this.prisma.egg.findUnique({ where: { id: data.egg } });
    if (!eggConfig) eggConfig = await this.prisma.egg.findUnique({ where: { name: data.egg } });
    if (!eggConfig) eggConfig = await this.prisma.egg.findUnique({ where: { remoteUuid: data.egg } });
    if (!eggConfig) throw new NotFoundException(`Egg "${data.egg}" not found`);
    if (!eggConfig.enabled) throw new BadRequestException(`Egg "${data.egg}" is disabled`);

    const allowedPackageIds = this.parseEggPackageIds(eggConfig.packageIds);
    if (allowedPackageIds.length > 0 && (!resources.packageId || !allowedPackageIds.includes(resources.packageId))) {
      throw new ForbiddenException('This egg is not available for your package');
    }

    // Fetch location config
    const locationConfig = await this.prisma.location.findUnique({ where: { remoteUuid: data.location } });
    if (!locationConfig) throw new NotFoundException(`Location "${data.location}" not found`);

    // Get current servers for resource check — fresh fetch inside lock
    let currentServers: any[] = [];
    try {
      const res = await this.calagopus.getUserServers(resources.calagopusId!);
      currentServers = res?.servers?.data ?? [];
    } catch { /* empty */ }

    const available = this.computeAvailableResources(resources, currentServers);

    // Validate resources
    if (available.available.servers <= 0) throw new ForbiddenException('No server slots available');
    if (data.ram > available.available.ram) throw new ForbiddenException(`Not enough RAM. Available: ${available.available.ram} MB`);
    if (data.disk > available.available.disk) throw new ForbiddenException(`Not enough disk. Available: ${available.available.disk} MB`);
    if (data.cpu > available.available.cpu) throw new ForbiddenException(`Not enough CPU. Available: ${available.available.cpu}%`);

    // Validate min/max from egg
    if (data.ram < eggConfig.minRam) throw new BadRequestException(`Minimum RAM: ${eggConfig.minRam} MB`);
    if (data.disk < eggConfig.minDisk) throw new BadRequestException(`Minimum disk: ${eggConfig.minDisk} MB`);
    if (data.cpu < eggConfig.minCpu) throw new BadRequestException(`Minimum CPU: ${eggConfig.minCpu}%`);
    if (data.ram > eggConfig.maxRam) throw new BadRequestException(`Maximum RAM: ${eggConfig.maxRam} MB`);
    if (data.disk > eggConfig.maxDisk) throw new BadRequestException(`Maximum disk: ${eggConfig.maxDisk} MB`);
    if (data.cpu > eggConfig.maxCpu) throw new BadRequestException(`Maximum CPU: ${eggConfig.maxCpu}%`);

    // Build environment from stored variables
    const rawEnv = typeof eggConfig.environment === 'string' ? JSON.parse(eggConfig.environment) : (eggConfig.environment || []);
    let environment: Record<string, string> = {};
    if (Array.isArray(rawEnv)) {
      for (const v of rawEnv) {
        environment[v.env_variable] = v.default_value ?? '';
      }
      if (data.environment) {
        for (const [key, val] of Object.entries(data.environment)) {
          const varDef = rawEnv.find((v: any) => v.env_variable === key);
          if (!varDef) continue;
          // Allow user_editable vars, or any jar/url/version/build var that exists on the egg
          const isJarOrUrlVar = /download.*path|download.*url|server.*jar.*file|jar.*file/i.test(varDef.name ?? '') ||
            /DL_PATH|SERVER_JARFILE|DOWNLOAD_URL|JAR_URL/i.test(key);
          if (varDef.user_editable || isJarOrUrlVar) {
            environment[key] = val as string;
          }
        }
      }
    } else {
      environment = rawEnv;
    }

    const rawFeatureLimits = typeof eggConfig.featureLimits === 'string' ? JSON.parse(eggConfig.featureLimits) : (eggConfig.featureLimits || {});
    const featureLimits = {
      allocations: rawFeatureLimits.allocations ?? 1,
      databases: rawFeatureLimits.databases ?? 0,
      backups: rawFeatureLimits.backups ?? 0,
      schedules: rawFeatureLimits.schedules ?? 0,
    };

    // Validate docker image selection
    let selectedImage = eggConfig.dockerImage || 'ghcr.io/pterodactyl/yolks:java_21';
    if (data.dockerImage) {
      const allowedImages = typeof eggConfig.dockerImages === 'string'
        ? JSON.parse(eggConfig.dockerImages) : (eggConfig.dockerImages || {});
      const allowedUris = Object.values(allowedImages) as string[];
      if (allowedUris.includes(data.dockerImage)) {
        selectedImage = data.dockerImage;
      }
    }

    const variables = Object.entries(environment).map(([env_variable, value]) => ({
      env_variable,
      value: String(value),
    }));

    // Find the port variable from the egg environment (SERVER_PORT, PORT, etc.)
    const portVarNames = ['SERVER_PORT', 'PORT', 'GAME_PORT', 'QUERY_PORT', 'SERVER_PORT_1'];
    const portVar = Array.isArray(rawEnv)
      ? (rawEnv.find((v: any) => portVarNames.includes(v.env_variable))?.env_variable ?? portVarNames[0])
      : portVarNames[0];

    const deploySpec = {
      name: data.name.trim(),
      description: null,
      egg_uuid: eggConfig.remoteUuid,
      startup: eggConfig.startup,
      image: selectedImage,
      variables,
      limits: {
        memory: data.ram,
        memory_overhead: 0,
        swap: -1,
        disk: data.disk,
        cpu: data.cpu,
        io_weight: 500,
      },
      feature_limits: featureLimits,
      deployment: {
        location_uuids: [locationConfig.remoteUuid],
        allow_overallocation: false,
        allocations: {
          dedicated: false,
          primary: {
            start_port: 1024,
            end_port: 65535,
            assign_to_variable: portVar,
          },
          additional: [],
        },
      },
      start_on_completion: true,
      skip_installer: false,
      pinned_cpus: [] as number[],
      hugepages_passthrough_enabled: false,
      kvm_passthrough_enabled: false,
    };

    const runDeploy = async (ownerUuid: string) => {
      const spec = { ...deploySpec, owner_uuid: ownerUuid };
      const result = await this.calagopus.deployServer(spec);
      return result.server ?? result;
    };

    try {
      const server = await runDeploy(resources.calagopusId!);
      if (server?.uuid) {
        await this.prisma.server.create({ data: { uuid: server.uuid, userId } });
      }
      return { success: true, server: { uuid: server.uuid, uuidShort: server.uuid_short, name: server.name } };
    } catch (err: any) {
      const isOwnerErr = err.message?.toLowerCase().includes('owner') || err.message?.toLowerCase().includes('owner_uuid');
      if (isOwnerErr) {
        // Force re-create the panel user and retry once
        resources = await this.ensurePanelUser(userId, resources, true);
        try {
          const server = await runDeploy(resources.calagopusId!);
          if (server?.uuid) {
            await this.prisma.server.create({ data: { uuid: server.uuid, userId } });
          }
          return { success: true, server: { uuid: server.uuid, uuidShort: server.uuid_short, name: server.name } };
        } catch (retryErr: any) {
          throw new BadRequestException(retryErr.message || 'Failed to create server after re-linking panel account');
        }
      }
      throw new BadRequestException(err.message || 'Failed to create server');
    }
  }

  private async ensurePanelUser(userId: string, resources: any, forceRecreate = false): Promise<any> {
    if (!forceRecreate) {
      try {
        const data = await this.calagopus.getUserByUuid(resources.calagopusId);
        const user = data?.user ?? data;
        if (user?.uuid) return resources;
      } catch (err: any) {
        const status = err instanceof HttpException ? err.getStatus() : 0;
        if (status !== 404 && !err.message?.toLowerCase().includes('not found')) throw err;
      }
    }
    // Re-create panel user
    const panelUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!panelUser) throw new BadRequestException('User not found');
    const base = (panelUser.name || panelUser.email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 8);
    const username = `${base}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const created = await this.calagopus.createUser({
        username,
        email: panelUser.email,
        name: panelUser.name || username,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        external_id: panelUser.id,
      });
      const newCid = created?.user?.uuid ?? created?.attributes?.uuid ?? created?.uuid ?? null;
      if (!newCid) throw new Error('No UUID returned from panel');
      await this.prisma.userResources.update({ where: { userId }, data: { calagopusId: newCid } });
      return this.getUserResources(userId);
    } catch (createErr: any) {
      throw new BadRequestException('Could not create panel account: ' + (createErr.message || ''));
    }
  }

  async modifyServer(userId: string, serverUuid: string, data: { ram: number; disk: number; cpu: number }) {
    return this.withUserLock(userId, async () => {
      const resources = await this.getUserResources(userId);
      if (!resources.calagopusId) throw new BadRequestException('No Calagopus account linked');

      // Get server details to verify ownership
      const serverRes = await this.calagopus.getServer(serverUuid);
      const server = serverRes?.server;
      if (!server) throw new NotFoundException('Server not found');
      if (server.owner?.uuid !== resources.calagopusId) {
        throw new ForbiddenException('You do not own this server');
      }

      // Get all user's servers (excluding current) for resource calculation
      const allRes = await this.calagopus.getUserServers(resources.calagopusId);
      const allServers = allRes?.servers?.data ?? [];
      const otherServers = allServers.filter((s: any) => s.uuid !== serverUuid);
      const available = this.computeAvailableResources(resources, otherServers);

      if (data.ram > available.available.ram) throw new ForbiddenException(`Not enough RAM. Available: ${available.available.ram} MB`);
      if (data.disk > available.available.disk) throw new ForbiddenException(`Not enough disk. Available: ${available.available.disk} MB`);
      if (data.cpu > available.available.cpu) throw new ForbiddenException(`Not enough CPU. Available: ${available.available.cpu}%`);

      await this.calagopus.updateServer(serverUuid, {
        limits: {
          memory: data.ram,
          disk: data.disk,
          cpu: data.cpu,
          swap: server.limits?.swap ?? -1,
        },
        feature_limits: server.feature_limits,
      });

      return { success: true };
    });
  }

  async deleteServer(userId: string, serverUuid: string) {
    const resources = await this.getUserResources(userId);
    if (!resources.calagopusId) throw new BadRequestException('No Calagopus account linked');

    const serverRes = await this.calagopus.getServer(serverUuid);
    const server = serverRes?.server;
    if (!server) throw new NotFoundException('Server not found');
    if (server.owner?.uuid !== resources.calagopusId) {
      throw new ForbiddenException('You do not own this server');
    }

    if (server.is_suspended) {
      throw new ForbiddenException('Cannot delete a suspended server');
    }

    await this.calagopus.deleteServer(serverUuid);
    await this.prisma.server.deleteMany({ where: { uuid: serverUuid } });
    return { success: true };
  }

  // ── Ownership verification helper ──

  private async verifyOwnership(userId: string, serverUuid: string) {
    const resources = await this.getUserResources(userId);
    if (!resources.calagopusId) throw new BadRequestException('No Calagopus account linked');
    const serverRes = await this.calagopus.getServer(serverUuid);
    const server = serverRes?.server ?? serverRes;
    if (!server) throw new NotFoundException('Server not found');
    if (server.owner?.uuid !== resources.calagopusId) {
      throw new ForbiddenException('You do not own this server');
    }
    return { server, calagopusId: resources.calagopusId };
  }

  // ── Server detail ──

  async getServerDetail(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    const [detail, resources] = await Promise.all([
      this.calagopus.clientGetServer(serverUuid),
      this.calagopus.clientGetServerResources(serverUuid).catch(() => null),
    ]);
    return { server: detail?.server ?? detail, resources };
  }

  // ── Power & Command ──

  async sendPowerAction(userId: string, serverUuid: string, action: 'start' | 'stop' | 'restart' | 'kill') {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientSendPowerAction(serverUuid, action);
  }

  async sendCommand(userId: string, serverUuid: string, command: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientSendCommand(serverUuid, command);
  }

  // ── WebSocket ──

  async getWebsocket(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetWebsocket(serverUuid);
  }

  // ── Resources ──

  async getServerResources(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    try {
      return await this.calagopus.clientGetServerResources(serverUuid);
    } catch (err: any) {
      if (err.message?.includes('409')) {
        return { state: 'installing', cpu_absolute: 0, memory_bytes: 0, disk_bytes: 0, network: { tx_bytes: 0, rx_bytes: 0 } };
      }
      throw err;
    }
  }

  // ── Files ──

  async listFiles(userId: string, serverUuid: string, directory: string) {
    await this.verifyOwnership(userId, serverUuid);
    try {
      return await this.calagopus.clientListFiles(serverUuid, directory);
    } catch (err: any) {
      if (err.message?.includes('409')) {
        throw new BadRequestException('Server installation failed. Please reinstall from Settings.');
      }
      throw err;
    }
  }

  async getFileContents(userId: string, serverUuid: string, file: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetFileContents(serverUuid, file);
  }

  async writeFile(userId: string, serverUuid: string, file: string, content: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientWriteFile(serverUuid, file, content);
  }

  async createDirectory(userId: string, serverUuid: string, root: string, name: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientCreateDirectory(serverUuid, root, name);
  }

  async deleteFiles(userId: string, serverUuid: string, root: string, files: string[]) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientDeleteFiles(serverUuid, root, files);
  }

  async renameFiles(userId: string, serverUuid: string, root: string, files: { from: string; to: string }[]) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientRenameFiles(serverUuid, root, files);
  }

  async compressFiles(userId: string, serverUuid: string, root: string, files: string[]) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientCompressFiles(serverUuid, root, files);
  }

  async decompressFile(userId: string, serverUuid: string, root: string, file: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientDecompressFile(serverUuid, root, file);
  }

  async getFileDownloadUrl(userId: string, serverUuid: string, file: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetFileDownloadUrl(serverUuid, file);
  }

  async getFileUploadUrl(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetFileUploadUrl(serverUuid);
  }

  // ── Backups ──

  async listBackups(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientListBackups(serverUuid);
  }

  async createBackup(userId: string, serverUuid: string, name?: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientCreateBackup(serverUuid, name);
  }

  async deleteBackup(userId: string, serverUuid: string, backupUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientDeleteBackup(serverUuid, backupUuid);
  }

  async downloadBackup(userId: string, serverUuid: string, backupUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientDownloadBackup(serverUuid, backupUuid);
  }

  async restoreBackup(userId: string, serverUuid: string, backupUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientRestoreBackup(serverUuid, backupUuid);
  }

  // ── Startup Variables ──

  async getStartupVariables(userId: string, serverUuid: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetStartupVariables(serverUuid);
  }

  async updateStartupVariables(userId: string, serverUuid: string, variables: Record<string, string>) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientUpdateStartupVariables(serverUuid, variables);
  }

  async updateDockerImage(userId: string, serverUuid: string, image: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientUpdateDockerImage(serverUuid, image);
  }

  async installPlugin(userId: string, serverUuid: string, downloadUrl: string, filename: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientInstallPlugin(serverUuid, downloadUrl, filename);
  }

  // ── Settings ──

  async renameServer(userId: string, serverUuid: string, name: string) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientRenameServer(serverUuid, name);
  }

  async reinstallServer(userId: string, serverUuid: string, truncateDirectory = true) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientReinstallServer(serverUuid, truncateDirectory);
  }

  // ── Activity ──

  async getActivity(userId: string, serverUuid: string, page?: number) {
    await this.verifyOwnership(userId, serverUuid);
    return this.calagopus.clientGetActivity(serverUuid, page);
  }

  async getStats() {
    return this.calagopus.getStats();
  }

  // ── Eggs & Locations for frontend ──

  async getAvailableEggs(userId: string) {
    const [resources, eggs] = await Promise.all([
      this.getUserResources(userId),
      this.prisma.egg.findMany({
        where: { enabled: true },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);

    return eggs.filter((egg) => {
      const allowedPackageIds = this.parseEggPackageIds(egg.packageIds);
      if (allowedPackageIds.length === 0) return true;
      return resources.packageId ? allowedPackageIds.includes(resources.packageId) : false;
    });
  }

  async getAvailableLocations() {
    return this.prisma.location.findMany({ orderBy: { name: 'asc' } });
  }

  async getAvailablePackages() {
    return this.prisma.package.findMany({ orderBy: { sortOrder: 'asc' } });
  }
}
