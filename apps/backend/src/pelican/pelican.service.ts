import { Injectable, BadRequestException, ForbiddenException, UnauthorizedException, HttpException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number>;
}

@Injectable()
export class CalagopusService {
  constructor(private settings: SettingsService) {}

  private configCache: { url: string; apiKey: string; expiry: number } | null = null;

  private async getConfig() {
    if (this.configCache && Date.now() < this.configCache.expiry) {
      return { url: this.configCache.url, apiKey: this.configCache.apiKey };
    }

    const config = await this.settings.getMany(['panel.url', 'panel.apiKey']);
    const url = config['panel.url']?.replace(/\/$/, '');
    const apiKey = config['panel.apiKey']?.trim();

    console.log('[CalagopusService] getConfig - url:', url || '(missing)', 'apiKey:', apiKey ? `${apiKey.substring(0, 8)}... (${apiKey.length} chars)` : '(missing)');

    if (!url || !apiKey) {
      throw new Error('Panel URL and API key not configured. Go to Admin > Settings.');
    }

    this.configCache = { url, apiKey, expiry: Date.now() + 60_000 };
    return { url, apiKey };
  }

  clearConfigCache() {
    this.configCache = null;
  }

  private async request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
    const { url, apiKey } = await this.getConfig();
    const { method = 'GET', body, params } = options;

    let fullUrl = `${url}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        qs.set(k, String(v));
      }
      fullUrl += `?${qs.toString()}`;
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const detail = errorBody?.error
        || errorBody?.message
        || errorBody?.errors?.map((e: any) => typeof e === 'string' ? e : (e.detail || e.message)).join('; ')
        || null;

      console.error(`[CalagopusService] ${method} ${path} → ${res.status}`, detail || errorBody);

      // On 401, clear cached config and retry once (settings may have been updated)
      if (res.status === 401 && retry) {
        console.warn(`[CalagopusService] 401 on ${path}, clearing config cache and retrying...`);
        this.clearConfigCache();
        return this.request<T>(path, options, false);
      }

      if (res.status === 400) {
        throw new BadRequestException(detail || 'Bad request');
      }
      if (res.status === 403) {
        throw new ForbiddenException(`Calagopus API returned 403 Forbidden for ${path}. Check that your API key is valid and has admin permissions.`);
      }
      if (res.status === 401) {
        throw new UnauthorizedException(`Calagopus API returned 401 Unauthorized. Check your API key in Admin > Settings.`);
      }
      throw new HttpException(detail || `Calagopus API error ${res.status}`, res.status);
    }

    if (res.status === 204) return {} as T;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    // Return text for non-JSON responses (e.g. file contents)
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text as unknown as T; }
  }

  // ── Helper: fetch all pages ──

  async fetchAll<T>(path: string, key: string, perPage = 100): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    while (true) {
      const res = await this.request<any>(path, { params: { page, per_page: perPage } });
      const paginated = res[key];
      if (!paginated?.data) break;
      items.push(...paginated.data);
      if (items.length >= paginated.total) break;
      page++;
    }
    return items;
  }

  // ── Admin API: Users ──

  async listUsers(page = 1, perPage = 50) {
    return this.request<any>('/api/admin/users', { params: { page, per_page: perPage } });
  }

  async getUserByUuid(uuid: string) {
    return this.request<any>(`/api/admin/users/${uuid}`);
  }

  async createUser(data: { username: string; email: string; password: string; external_id?: string; admin?: boolean; name?: string }) {
    const [name_first = 'Panel', ...rest] = (data.name || data.username || 'Panel User').split(' ');
    const name_last = rest.join(' ') || 'User';
    return this.request<any>('/api/admin/users', {
      method: 'POST',
      body: {
        username: data.username,
        email: data.email,
        password: data.password,
        name_first,
        name_last,
        ...(data.external_id ? { external_id: data.external_id } : {}),
        ...(data.admin !== undefined ? { root_admin: data.admin } : {}),
      },
    });
  }

  async updateUser(uuid: string, data: { password?: string; username?: string; email?: string }) {
    return this.request<any>(`/api/admin/users/${uuid}`, { method: 'PATCH', body: data });
  }

  async getUserServers(userUuid: string, page = 1, perPage = 100) {
    return this.request<any>(`/api/admin/users/${userUuid}/servers`, { params: { page, per_page: perPage } });
  }

  // ── Admin API: Servers ──

  async listServers(page = 1, perPage = 50) {
    return this.request<any>('/api/admin/servers', { params: { page, per_page: perPage } });
  }

  async getServer(uuid: string) {
    return this.request<any>(`/api/admin/servers/${uuid}`);
  }

  async createServer(data: {
    name: string;
    description?: string | null;
    owner_uuid: string;
    egg_uuid: string;
    node_uuid: string;
    allocation_uuids: string[];
    start_on_completion: boolean;
    skip_installer: boolean;
    startup: string;
    image: string;
    variables: { env_variable: string; value: string }[];
    limits: { cpu: number; memory: number; memory_overhead: number; swap: number; disk: number; io_weight?: number };
    pinned_cpus: number[];
    hugepages_passthrough_enabled: boolean;
    kvm_passthrough_enabled: boolean;
    feature_limits: { allocations: number; databases: number; backups: number; schedules: number };
  }) {
    return this.request<any>('/api/admin/servers', { method: 'POST', body: data });
  }

  async updateServer(uuid: string, data: any) {
    return this.request<any>(`/api/admin/servers/${uuid}`, { method: 'PATCH', body: data });
  }

  async deleteServer(uuid: string) {
    return this.request<any>(`/api/admin/servers/${uuid}`, { method: 'DELETE' });
  }

  async suspendServer(uuid: string) {
    return this.request<any>(`/api/admin/servers/${uuid}/suspend`, { method: 'POST' });
  }

  async unsuspendServer(uuid: string) {
    return this.request<any>(`/api/admin/servers/${uuid}/unsuspend`, { method: 'POST' });
  }

  // ── Admin API: Nodes ──

  async listNodes(page = 1, perPage = 50) {
    return this.request<any>('/api/admin/nodes', { params: { page, per_page: perPage } });
  }

  async getNode(uuid: string) {
    return this.request<any>(`/api/admin/nodes/${uuid}`);
  }

  async listNodeAllocations(nodeId: number, page = 1, perPage = 100) {
    return this.request<any>(`/api/admin/nodes/${nodeId}/allocations`, { params: { page, per_page: perPage } });
  }

  async listNodeAllocationsByUuid(nodeUuid: string, perPage = 200) {
    return this.request<any>(`/api/admin/nodes/${nodeUuid}/allocations`, { params: { per_page: perPage } });
  }

  async findAvailableAllocation(locationUuid: string, nodeUuids: string[]): Promise<{ nodeUuid: string; allocationUuid: string } | null> {
    console.log(`[CalagopusService] Looking for allocation in location ${locationUuid}, candidate nodes: ${nodeUuids.length}`);

    for (const nodeUuid of nodeUuids) {
      try {
        const res = await this.request<any>(`/api/admin/nodes/${nodeUuid}/allocations`, { params: { per_page: 50 } });
        // Response may be { data: [...] } or { allocations: { data: [...] } }
        const allocations = res?.data ?? res?.allocations?.data ?? [];
        
        console.log(`[CalagopusService] Node ${nodeUuid}: ${allocations.length} allocations, sample:`, JSON.stringify(allocations[0] ?? {}).substring(0, 300));

        // Find unassigned allocation — check for server being null/undefined/empty
        const free = allocations.find((a: any) => !a.server && !a.server_uuid);
        if (free) {
          console.log(`[CalagopusService] Found free allocation: uuid=${free.uuid}, port=${free.port}`);
          return { nodeUuid, allocationUuid: free.uuid };
        }
      } catch (err: any) {
        console.warn(`[CalagopusService] Failed to get allocations for node ${nodeUuid}:`, err.message);
        continue;
      }
    }
    return null;
  }

  // ── Admin API: Locations ──

  async listLocations(page = 1, perPage = 50) {
    return this.request<any>('/api/admin/locations', { params: { page, per_page: perPage } });
  }

  async getLocation(uuid: string) {
    return this.request<any>(`/api/admin/locations/${uuid}`);
  }

  // ── Admin API: Nests & Eggs ──

  async listNests(page = 1, perPage = 50) {
    return this.request<any>('/api/admin/nests', { params: { page, per_page: perPage } });
  }

  async listNestEggs(nestUuid: string, page = 1, perPage = 50) {
    return this.request<any>(`/api/admin/nests/${nestUuid}/eggs`, { params: { page, per_page: perPage } });
  }

  async getEgg(nestUuid: string, eggUuid: string) {
    return this.request<any>(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}`, { params: { include: 'variables' } });
  }

  async getEggVariables(nestUuid: string, eggUuid: string) {
    return this.request<any>(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables`);
  }

  // ── Client API: Servers ──

  async clientListServers(page = 1) {
    return this.request<any>('/api/client/servers', { params: { page, per_page: 100 } });
  }

  async clientGetServer(serverUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}`);
  }

  async clientGetServerResources(serverUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/resources`);
  }

  async clientSendPowerAction(serverUuid: string, action: 'start' | 'stop' | 'restart' | 'kill') {
    return this.request<any>(`/api/client/servers/${serverUuid}/power`, { method: 'POST', body: { action } });
  }

  async clientSendCommand(serverUuid: string, command: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/command`, { method: 'POST', body: { command } });
  }

  // ── Client API: Files ──

  async clientListFiles(serverUuid: string, directory = '/') {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/list`, { params: { directory } });
  }

  async clientGetFileContents(serverUuid: string, file: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/contents`, { params: { file } });
  }

  async clientWriteFile(serverUuid: string, file: string, content: string) {
    const { url, apiKey } = await this.getConfig();
    const res = await fetch(`${url}/api/client/servers/${serverUuid}/files/write?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'text/plain', 'Authorization': `Bearer ${apiKey}` },
      body: content,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new BadRequestException(err?.errors?.map((e: any) => typeof e === 'string' ? e : e.detail).join('; ') || `Write failed: ${res.status}`);
    }
    return {};
  }

  async clientCreateDirectory(serverUuid: string, root: string, name: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/create-directory`, { method: 'POST', body: { root, name } });
  }

  async clientDeleteFiles(serverUuid: string, root: string, files: string[]) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/delete`, { method: 'POST', body: { root, files } });
  }

  async clientRenameFiles(serverUuid: string, root: string, files: { from: string; to: string }[]) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/rename`, { method: 'PUT', body: { root, files } });
  }

  async clientCompressFiles(serverUuid: string, root: string, files: string[]) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/compress`, { method: 'POST', body: { root, files } });
  }

  async clientDecompressFile(serverUuid: string, root: string, file: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/decompress`, { method: 'POST', body: { root, file } });
  }

  async clientGetFileDownloadUrl(serverUuid: string, file: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/download`, { params: { file } });
  }

  async clientGetFileUploadUrl(serverUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/files/upload`);
  }

  // ── Client API: Backups ──

  async clientListBackups(serverUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/backups`);
  }

  async clientCreateBackup(serverUuid: string, name?: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/backups`, { method: 'POST', body: { name: name || `Backup ${new Date().toISOString()}`, ignored_files: [] } });
  }

  async clientDeleteBackup(serverUuid: string, backupUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/backups/${backupUuid}`, { method: 'DELETE' });
  }

  async clientDownloadBackup(serverUuid: string, backupUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/backups/${backupUuid}/download`);
  }

  async clientRestoreBackup(serverUuid: string, backupUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/backups/${backupUuid}/restore`, { method: 'POST' });
  }

  // ── Client API: WebSocket ──

  async clientGetWebsocket(serverUuid: string) {
    return this.request<{ token: string; url: string }>(`/api/client/servers/${serverUuid}/websocket`);
  }

  // ── Client API: Startup Variables ──

  async clientGetStartupVariables(serverUuid: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/startup/variables`);
  }

  async clientUpdateStartupVariables(serverUuid: string, variables: Record<string, string>) {
    const payload = {
      variables: Object.entries(variables).map(([env_variable, value]) => ({ env_variable, value })),
    };
    return this.request<any>(`/api/client/servers/${serverUuid}/startup/variables`, { method: 'PUT', body: payload });
  }

  async clientUpdateDockerImage(serverUuid: string, image: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/startup/docker-image`, { method: 'PUT', body: { docker_image: image } });
  }

  // ── Client API: Settings ──

  async clientRenameServer(serverUuid: string, name: string) {
    return this.request<any>(`/api/client/servers/${serverUuid}/settings/rename`, { method: 'POST', body: { name } });
  }

  async clientReinstallServer(serverUuid: string, truncateDirectory = true) {
    return this.request<any>(`/api/client/servers/${serverUuid}/settings/install`, { method: 'POST', body: { truncate_directory: truncateDirectory } });
  }

  // ── Client API: Activity ──

  async clientGetActivity(serverUuid: string, page = 1) {
    return this.request<any>(`/api/client/servers/${serverUuid}/activity`, { params: { page, per_page: 25 } });
  }

  // ── Stats ──

  async getStats() {
    try {
      const [users, servers, nodes, locations] = await Promise.all([
        this.listUsers(1, 1),
        this.listServers(1, 1),
        this.listNodes(1, 1),
        this.listLocations(1, 1),
      ]);
      return {
        users: users.users?.total ?? 0,
        servers: servers.servers?.total ?? 0,
        nodes: nodes.nodes?.total ?? 0,
        locations: locations.locations?.total ?? 0,
      };
    } catch {
      return { users: 0, servers: 0, nodes: 0, locations: 0 };
    }
  }
}
