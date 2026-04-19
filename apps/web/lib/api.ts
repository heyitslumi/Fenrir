const API_BASE: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

let _isRefreshing: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const { getRefreshToken, setTokens, clearTokens } = await import('@/lib/auth');
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) {
    if (!_isRefreshing) {
      _isRefreshing = tryRefreshToken().finally(() => { _isRefreshing = null; });
    }
    const newToken = await _isRefreshing;
    if (newToken) {
      const retryRes = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (retryRes.ok) {
        const ct = retryRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) return retryRes.json();
        const text = await retryRes.text();
        try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
      }
      const error = await retryRes.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${retryRes.status}`);
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  permissions: string[];
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  permissions: string[];
  createdAt: string;
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; name?: string }) =>
      request<AuthResponse>('/auth/register', { method: 'POST', body: data }),

    login: (data: { email: string; password: string }) =>
      request<AuthResponse & { require2fa?: boolean; challengeToken?: string }>('/auth/login', { method: 'POST', body: data }),

    twofa: {
      status: (token: string) =>
        request<{ enabled: boolean }>('/auth/2fa/status', { token }),
      setup: (token: string) =>
        request<{ secret: string; qrCode: string }>('/auth/2fa/setup', { method: 'POST', token }),
      enable: (token: string, code: string) =>
        request<{ message: string }>('/auth/2fa/enable', { method: 'POST', token, body: { code } }),
      disable: (token: string, code: string) =>
        request<{ message: string }>('/auth/2fa/disable', { method: 'POST', token, body: { code } }),
      verify: (challengeToken: string, code: string) =>
        request<AuthResponse>('/auth/2fa/verify', { method: 'POST', body: { challengeToken, code } }),
    },

    refresh: (refreshToken: string) =>
      request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } }),

    logout: (token: string) =>
      request<{ message: string }>('/auth/logout', { method: 'POST', token }),

    me: (token: string) =>
      request<{ user: AuthUser | null }>('/auth/me', { token }),

    passkey: {
      registerOptions: (token: string) =>
        request<any>('/auth/passkey/register/options', { method: 'POST', token }),

      registerVerify: (token: string, credential: any, name?: string) =>
        request<{ verified: boolean }>('/auth/passkey/register/verify', { method: 'POST', token, body: { credential, name } }),

      authOptions: () =>
        request<any>('/auth/passkey/authenticate/options', { method: 'POST' }),

      authVerify: (challengeId: string, credential: any) =>
        request<AuthResponse>('/auth/passkey/authenticate/verify', { method: 'POST', body: { challengeId, credential } }),

      list: (token: string) =>
        request<{ id: string; credentialId: string; name: string; deviceType: string; backedUp: boolean; createdAt: string }[]>('/auth/passkeys', { token }),

      delete: (token: string, id: string) =>
        request<{ message: string }>(`/auth/passkeys/${id}`, { method: 'DELETE', token }),
    },

    sessions: {
      list: (token: string) =>
        request<{ id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; current: boolean }[]>('/auth/sessions', { token }),

      delete: (token: string, id: string) =>
        request<{ message: string }>(`/auth/sessions/${id}`, { method: 'DELETE', token }),
    },

    oauth: {
      linked: (token: string) =>
        request<{ provider: string; providerUid: string; username: string | null; createdAt: string }[]>('/auth/oauth/linked', { token }),

      unlink: (token: string, provider: string) =>
        request<{ message: string }>(`/auth/oauth/linked/${provider}`, { method: 'DELETE', token }),
    },
  },

  users: {
    list: (token: string) =>
      request<UserListItem[]>('/users', { token }),

    get: (token: string, id: string) =>
      request<UserListItem>(`/users/${id}`, { token }),

    updateRole: (token: string, id: string, role: string) =>
      request<UserListItem>(`/users/${id}/role`, { method: 'PATCH', token, body: { role } }),

    delete: (token: string, id: string) =>
      request<{ message: string }>(`/users/${id}`, { method: 'DELETE', token }),

    updateProfile: (token: string, data: { name?: string }) =>
      request<{ id: string; email: string; name: string | null; avatar: string | null }>('/users/me/profile', { method: 'PATCH', token, body: data }),

    uploadAvatar: async (token: string, file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ avatar: string }>;
    },

    panelAccount: (token: string) =>
      request<{ linked: boolean; calagopusId: string | null; username: string | null; email: string | null }>('/users/me/panel-account', { token }),

    resetPanelPassword: (token: string) =>
      request<{ password: string }>('/users/me/panel-account/reset-password', { method: 'POST', token }),
  },

  settings: {
    getAll: (token: string) =>
      request<Record<string, string>>('/settings', { token }),

    getPanelConfig: (token: string) =>
      request<Record<string, string>>('/settings/panel', { token }),

    getBrand: () =>
      request<BrandConfig>('/settings/brand', {}),

    update: (token: string, data: Record<string, string>) =>
      request<{ message: string }>('/settings', { method: 'PUT', token, body: data }),

    set: (token: string, key: string, value: string) =>
      request<{ message: string }>(`/settings/${key}`, { method: 'PUT', token, body: { value } }),

    testEmail: (token: string, email: string) =>
      request<{ success: boolean; error?: string }>('/settings/test-email', { method: 'POST', token, body: { email } }),
  },

  servers: {
    list: (token: string) =>
      request<ServerListResponse>('/servers', { token }),

    create: (token: string, data: CreateServerData) =>
      request<{ success: boolean; server: { uuid: string; uuidShort: string; name: string } }>('/servers', { method: 'POST', token, body: data }),

    modify: (token: string, uuid: string, data: { ram: number; disk: number; cpu: number }) =>
      request<{ success: boolean }>(`/servers/${uuid}`, { method: 'PATCH', token, body: data }),

    delete: (token: string, uuid: string) =>
      request<{ success: boolean }>(`/servers/${uuid}`, { method: 'DELETE', token }),

    stats: (token: string) =>
      request<PanelStats>('/servers/stats', { token }),

    eggs: (token: string) =>
      request<EggConfig[]>('/servers/eggs', { token }),

    locations: (token: string) =>
      request<LocationConfig[]>('/servers/locations', { token }),

    packages: (token: string) =>
      request<PackageConfig[]>('/servers/packages', { token }),

    // Server detail
    get: (token: string, uuid: string) =>
      request<{ server: any; resources: any }>(`/servers/${uuid}`, { token }),

    // Power & Command
    power: (token: string, uuid: string, action: 'start' | 'stop' | 'restart' | 'kill') =>
      request<any>(`/servers/${uuid}/power`, { method: 'POST', token, body: { action } }),

    command: (token: string, uuid: string, command: string) =>
      request<any>(`/servers/${uuid}/command`, { method: 'POST', token, body: { command } }),

    // WebSocket
    websocket: (token: string, uuid: string) =>
      request<{ token: string; url: string }>(`/servers/${uuid}/websocket`, { token }),

    // Resources
    resources: (token: string, uuid: string) =>
      request<any>(`/servers/${uuid}/resources`, { token }),

    // Files
    files: {
      list: (token: string, uuid: string, directory = '/') =>
        request<any>(`/servers/${uuid}/files/list?directory=${encodeURIComponent(directory)}`, { token }),

      contents: (token: string, uuid: string, file: string) =>
        request<any>(`/servers/${uuid}/files/contents?file=${encodeURIComponent(file)}`, { token }),

      write: (token: string, uuid: string, file: string, content: string) =>
        request<any>(`/servers/${uuid}/files/write`, { method: 'POST', token, body: { file, content } }),

      createDirectory: (token: string, uuid: string, root: string, name: string) =>
        request<any>(`/servers/${uuid}/files/create-directory`, { method: 'POST', token, body: { root, name } }),

      deleteFiles: (token: string, uuid: string, root: string, files: string[]) =>
        request<any>(`/servers/${uuid}/files/delete`, { method: 'POST', token, body: { root, files } }),

      rename: (token: string, uuid: string, root: string, files: { from: string; to: string }[]) =>
        request<any>(`/servers/${uuid}/files/rename`, { method: 'PUT', token, body: { root, files } }),

      compress: (token: string, uuid: string, root: string, files: string[]) =>
        request<any>(`/servers/${uuid}/files/compress`, { method: 'POST', token, body: { root, files } }),

      decompress: (token: string, uuid: string, root: string, file: string) =>
        request<any>(`/servers/${uuid}/files/decompress`, { method: 'POST', token, body: { root, file } }),

      downloadUrl: (token: string, uuid: string, file: string) =>
        request<any>(`/servers/${uuid}/files/download?file=${encodeURIComponent(file)}`, { token }),

      uploadUrl: (token: string, uuid: string) =>
        request<any>(`/servers/${uuid}/files/upload`, { token }),
    },

    // Backups
    backups: {
      list: (token: string, uuid: string) =>
        request<any>(`/servers/${uuid}/backups`, { token }),

      create: (token: string, uuid: string, name?: string) =>
        request<any>(`/servers/${uuid}/backups`, { method: 'POST', token, body: { name } }),

      remove: (token: string, uuid: string, backupUuid: string) =>
        request<any>(`/servers/${uuid}/backups/${backupUuid}`, { method: 'DELETE', token }),

      download: (token: string, uuid: string, backupUuid: string) =>
        request<any>(`/servers/${uuid}/backups/${backupUuid}/download`, { token }),

      restore: (token: string, uuid: string, backupUuid: string) =>
        request<any>(`/servers/${uuid}/backups/${backupUuid}/restore`, { method: 'POST', token }),
    },

    // Startup
    startup: {
      get: (token: string, uuid: string) =>
        request<any>(`/servers/${uuid}/startup`, { token }),

      update: (token: string, uuid: string, variables: Record<string, string>) =>
        request<any>(`/servers/${uuid}/startup`, { method: 'PUT', token, body: variables }),

      updateDockerImage: (token: string, uuid: string, image: string) =>
        request<any>(`/servers/${uuid}/docker-image`, { method: 'PUT', token, body: { image } }),
    },

    // Settings
    rename: (token: string, uuid: string, name: string) =>
      request<any>(`/servers/${uuid}/rename`, { method: 'POST', token, body: { name } }),

    reinstall: (token: string, uuid: string, truncateDirectory = true) =>
      request<any>(`/servers/${uuid}/reinstall`, { method: 'POST', token, body: { truncate_directory: truncateDirectory } }),

    // Plugins
    plugins: {
      install: (token: string, uuid: string, downloadUrl: string, filename: string) =>
        request<{ success: boolean; file: string }>(`/servers/${uuid}/plugins/install`, { method: 'POST', token, body: { downloadUrl, filename } }),
    },

    // Activity
    activity: (token: string, uuid: string, page = 1) =>
      request<any>(`/servers/${uuid}/activity?page=${page}`, { token }),
  },

  store: {
    items: (token: string) =>
      request<StoreItem[]>('/store/items', { token }),

    resources: (token: string) =>
      request<UserResourcesResponse>('/store/resources', { token }),

    buy: (token: string, resource: string, amount: number) =>
      request<{ success: boolean; spent: number; resource: string; amount: number }>('/store/buy', { method: 'POST', token, body: { resource, amount } }),

    claimDaily: (token: string) =>
      request<{ success: boolean; amount: number }>('/store/daily', { method: 'POST', token }),

    dailyStatus: (token: string) =>
      request<{ available: boolean; hoursLeft?: number; reason?: string }>('/store/daily', { token }),
  },

  admin: {
    // Eggs
    listEggs: (token: string) =>
      request<EggConfig[]>('/admin/eggs', { token }),
    createEgg: (token: string, data: any) =>
      request<EggConfig>('/admin/eggs', { method: 'POST', token, body: data }),
    updateEgg: (token: string, id: string, data: any) =>
      request<EggConfig>(`/admin/eggs/${id}`, { method: 'PATCH', token, body: data }),
    deleteEgg: (token: string, id: string) =>
      request<{ message: string }>(`/admin/eggs/${id}`, { method: 'DELETE', token }),

    // Locations
    listLocations: (token: string) =>
      request<LocationConfig[]>('/admin/locations', { token }),
    createLocation: (token: string, data: any) =>
      request<LocationConfig>('/admin/locations', { method: 'POST', token, body: data }),
    updateLocation: (token: string, id: string, data: any) =>
      request<LocationConfig>(`/admin/locations/${id}`, { method: 'PATCH', token, body: data }),
    deleteLocation: (token: string, id: string) =>
      request<{ message: string }>(`/admin/locations/${id}`, { method: 'DELETE', token }),

    // Packages
    listPackages: (token: string) =>
      request<PackageConfig[]>('/admin/packages', { token }),
    createPackage: (token: string, data: any) =>
      request<PackageConfig>('/admin/packages', { method: 'POST', token, body: data }),
    updatePackage: (token: string, id: string, data: any) =>
      request<PackageConfig>(`/admin/packages/${id}`, { method: 'PATCH', token, body: data }),
    deletePackage: (token: string, id: string) =>
      request<{ message: string }>(`/admin/packages/${id}`, { method: 'DELETE', token }),

    // Store Items
    listStoreItems: (token: string) =>
      request<StoreItem[]>('/admin/store-items', { token }),
    upsertStoreItem: (token: string, data: any) =>
      request<StoreItem>('/admin/store-items', { method: 'POST', token, body: data }),
    deleteStoreItem: (token: string, id: string) =>
      request<{ message: string }>(`/admin/store-items/${id}`, { method: 'DELETE', token }),

    // User Resources
    getUserResources: (token: string, userId: string) =>
      request<UserResourcesResponse>(`/admin/user-resources/${userId}`, { token }),
    updateUserResources: (token: string, userId: string, data: any) =>
      request<UserResourcesResponse>(`/admin/user-resources/${userId}`, { method: 'PATCH', token, body: data }),

    // Nodes
    listNodes: (token: string) =>
      request<NodeConfig[]>('/admin/nodes', { token }),

    // Sync
    syncAll: (token: string) =>
      request<SyncResult>('/admin/sync', { method: 'POST', token }),
    syncLocations: (token: string) =>
      request<SyncPartialResult>('/admin/sync/locations', { method: 'POST', token }),
    syncNodes: (token: string) =>
      request<SyncPartialResult>('/admin/sync/nodes', { method: 'POST', token }),
    syncEggs: (token: string) =>
      request<SyncEggsResult>('/admin/sync/eggs', { method: 'POST', token }),

    // Roles
    listRoles: (token: string) =>
      request<AdminRole[]>('/admin/roles', { token }),
    getRole: (token: string, id: string) =>
      request<AdminRole>(`/admin/roles/${id}`, { token }),
    createRole: (token: string, data: { name: string; description?: string; permissions?: string[] }) =>
      request<AdminRole>('/admin/roles', { method: 'POST', token, body: data }),
    updateRole: (token: string, id: string, data: { name?: string; description?: string; permissions?: string[] }) =>
      request<AdminRole>(`/admin/roles/${id}`, { method: 'PATCH', token, body: data }),
    deleteRole: (token: string, id: string) =>
      request<{ message: string }>(`/admin/roles/${id}`, { method: 'DELETE', token }),

    // Permissions
    listPermissions: (token: string) =>
      request<AdminPermission[]>('/admin/permissions', { token }),

    // User detail
    getUserDetail: (token: string, id: string) =>
      request<AdminUserDetail>(`/admin/users/${id}`, { token }),
    setUserCoins: (token: string, id: string, coins: number) =>
      request<any>(`/admin/users/${id}/coins`, { method: 'PATCH', token, body: { coins } }),
    setUserPackage: (token: string, id: string, packageId: string | null) =>
      request<any>(`/admin/users/${id}/package`, { method: 'PATCH', token, body: { packageId } }),
    setUserRole: (token: string, id: string, roleId: string) =>
      request<any>(`/admin/users/${id}/role`, { method: 'PATCH', token, body: { roleId } }),

    forceVerifyEmail: (token: string, id: string) =>
      request<{ message: string }>(`/admin/users/${id}/verify-email`, { method: 'POST', token }),
    setUserPanelId: (token: string, id: string, calagopusId: string) =>
      request<any>(`/admin/users/${id}/panel-id`, { method: 'PATCH', token, body: { calagopusId } }),

    // Servers (admin)
    listAllServers: (token: string, page = 1) =>
      request<any>(`/admin/servers?page=${page}`, { token }),
    suspendServer: (token: string, uuid: string) =>
      request<{ message: string }>(`/admin/servers/${uuid}/suspend`, { method: 'POST', token }),
    unsuspendServer: (token: string, uuid: string) =>
      request<{ message: string }>(`/admin/servers/${uuid}/unsuspend`, { method: 'POST', token }),
    deleteServer: (token: string, uuid: string) =>
      request<{ message: string }>(`/admin/servers/${uuid}`, { method: 'DELETE', token }),
    getServer: (token: string, uuid: string) =>
      request<any>(`/admin/servers/${uuid}`, { token }),
    updateServer: (token: string, uuid: string, data: any) =>
      request<any>(`/admin/servers/${uuid}`, { method: 'PATCH', token, body: data }),
    listNodeAllocations: (token: string, serverUuid: string, nodeUuid: string) =>
      request<any[]>(`/admin/servers/${serverUuid}/allocations?nodeUuid=${nodeUuid}`, { token }),
  },
};

// ─── Types ───

export interface ServerItem {
  uuid: string;
  uuidShort: string;
  name: string;
  description: string | null;
  status: string | null;
  suspended: boolean;
  limits: { memory: number; disk: number; cpu: number; swap: number };
  featureLimits: { allocations: number; databases: number; backups: number; schedules: number };
  egg: { uuid: string; name: string } | null;
  node: { uuid: string; name: string } | null;
  allocation: { uuid: string; ip: string; port: number } | null;
}

export interface ResourceUsage {
  total: { ram: number; disk: number; cpu: number; servers: number };
  used: { ram: number; disk: number; cpu: number; servers: number };
  available: { ram: number; disk: number; cpu: number; servers: number };
  coins: number;
}

export interface ServerListResponse {
  servers: ServerItem[];
  resources: ResourceUsage;
}

export interface CreateServerData {
  name: string;
  ram: number;
  disk: number;
  cpu: number;
  egg: string;
  location: string;
  environment?: Record<string, string>;
  dockerImage?: string;
}

export interface PanelStats {
  users: number;
  servers: number;
  nodes: number;
  locations: number;
}

export interface EggVariable {
  env_variable: string;
  name: string;
  description: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
}

export interface EggConfig {
  id: string;
  name: string;
  displayName: string;
  category: string;
  logo: string | null;
  remoteUuid: string;
  nestUuid: string;
  dockerImage: string;
  dockerImages: Record<string, string>;
  startup: string;
  environment: EggVariable[];
  minRam: number;
  minDisk: number;
  minCpu: number;
  maxRam: number;
  maxDisk: number;
  maxCpu: number;
}

export interface LocationConfig {
  id: string;
  remoteUuid: string;
  name: string;
  short: string;
  country: string | null;
  flag: string | null;
}

export interface PackageConfig {
  id: string;
  name: string;
  ram: number;
  disk: number;
  cpu: number;
  servers: number;
  isDefault: boolean;
}

export interface StoreItem {
  id: string;
  resource: string;
  cost: number;
  per: number;
  limit: number;
  enabled: boolean;
}

export interface UserResourcesResponse {
  id: string;
  userId: string;
  extraRam: number;
  extraDisk: number;
  extraCpu: number;
  extraServers: number;
  coins: number;
  packageId: string | null;
  calagopusId: string | null;
  lastDailyClaim: string | null;
  package: PackageConfig | null;
}

export interface NodeConfig {
  id: string;
  remoteUuid: string;
  name: string;
  fqdn: string;
  memory: number;
  disk: number;
  locationUuid: string | null;
}

export interface SyncPartialResult {
  synced: number;
  created: number;
  updated: number;
}

export interface SyncEggsResult {
  nests: number;
  eggs: number;
  created: number;
  updated: number;
}

export interface SyncResult {
  locations: SyncPartialResult;
  nodes: SyncPartialResult;
  eggs: SyncEggsResult;
}

export interface BrandConfig {
  'panel.name'?: string;
  'panel.logo'?: string;
  'panel.logoHeight'?: string;
  'auth.background'?: string;
  'auth.backgroundBlur'?: string;
}

export interface AdminPermission {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: { permission: AdminPermission }[];
  _count?: { users: number };
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
  role: string;
  roleId: string;
  permissions: string[];
  resources: UserResourcesResponse | null;
  servers: {
    uuid: string;
    name: string;
    status: string | null;
    suspended: boolean;
    limits: { memory: number; disk: number; cpu: number };
    node: { uuid: string; name: string } | null;
  }[];
  createdAt: string;
}
