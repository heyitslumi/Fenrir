'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type ServerItem, type ResourceUsage, type EggConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { Progress } from '@workspace/ui/components/progress';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import {
  ActivityIcon,
  ArrowRightIcon,
  ServerIcon,
  PlusIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  NetworkIcon,
  ShieldIcon,
  DatabaseIcon,
  Clock3Icon,
} from 'lucide-react';
import Link from 'next/link';

interface LiveStats {
  state?: string;
  cpu_absolute?: number;
  memory_bytes?: number;
  disk_bytes?: number;
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 MB';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  return `${(bytes / 1048576).toFixed(0)} MB`;
}

function formatLimit(limit: number) {
  return limit >= 1024 ? `${(limit / 1024).toFixed(1)} GB` : `${limit} MB`;
}

function ServerCard({ server, liveStats, eggLogo, onClick }: {
  server: ServerItem;
  liveStats: LiveStats | null;
  eggLogo?: string | null;
  onClick: () => void;
}) {
  const state = liveStats?.state ?? server.status ?? 'offline';
  const statusColor = server.suspended ? 'bg-destructive' :
    state === 'running' ? 'bg-emerald-500' :
    state === 'starting' ? 'bg-yellow-500' :
    state === 'stopping' ? 'bg-orange-500' :
    state === 'install_failed' ? 'bg-destructive' : 'bg-muted-foreground/50';

  const cpuText = liveStats?.cpu_absolute != null
    ? `${liveStats.cpu_absolute.toFixed(1)}%` : `${server.limits.cpu}%`;
  const memText = liveStats?.memory_bytes != null
    ? formatBytes(liveStats.memory_bytes) : (server.limits.memory >= 1024
      ? `${(server.limits.memory / 1024).toFixed(1)} GB` : `${server.limits.memory} MB`);
  const diskText = liveStats?.disk_bytes != null
    ? formatBytes(liveStats.disk_bytes) : (server.limits.disk >= 1024
      ? `${(server.limits.disk / 1024).toFixed(1)} GB` : `${server.limits.disk} MB`);

  return (
    <button type="button" className="w-full text-left" onClick={onClick}>
      <Card className="group hover:border-primary/20 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`size-2.5 rounded-full ${statusColor} ${state === 'running' ? 'animate-pulse' : ''}`} />
              {eggLogo ? (
                <img src={eggLogo} alt="" className="size-5 rounded object-contain" />
              ) : (
                <ServerIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{server.name}</p>
                {server.suspended && <Badge variant="destructive">Suspended</Badge>}
                {state === 'running' && <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">Running</Badge>}
                {state === 'starting' && <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs">Starting</Badge>}
                {state === 'install_failed' && <Badge variant="destructive" className="text-xs">Install Failed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {server.uuidShort}
                {server.allocation ? ` · ${server.allocation.ip}:${server.allocation.port}` : ''}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 flex-1 justify-end text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 flex-1 max-w-[200px]" title="CPU">
              <CpuIcon className="size-3.5 shrink-0" />
              <Progress value={liveStats?.cpu_absolute != null ? Math.min(100, liveStats.cpu_absolute / (server.limits.cpu || 100) * 100) : 0} className="h-1 flex-1" />
              <span className="shrink-0 tabular-nums">{cpuText}</span>
            </span>
            <span className="flex items-center gap-1.5 flex-1 max-w-[200px]" title="Memory">
              <MemoryStickIcon className="size-3.5 shrink-0" />
              <Progress value={liveStats?.memory_bytes != null ? Math.min(100, liveStats.memory_bytes / (server.limits.memory * 1024 * 1024) * 100) : 0} className="h-1 flex-1" />
              <span className="shrink-0 tabular-nums">{memText}</span>
            </span>
            <span className="flex items-center gap-1.5 flex-1 max-w-[200px]" title="Disk">
              <HardDriveIcon className="size-3.5 shrink-0" />
              <Progress value={liveStats?.disk_bytes != null ? Math.min(100, liveStats.disk_bytes / (server.limits.disk * 1024 * 1024) * 100) : 0} className="h-1 flex-1" />
              <span className="shrink-0 tabular-nums">{diskText}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export default function ServersPage() {
  use(AuthenticationContext);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStats, setLiveStats] = useState<Record<string, LiveStats>>({});
  const [eggs, setEggs] = useState<EggConfig[]>([]);
  const [selectedServerUuid, setSelectedServerUuid] = useState<string | null>(null);
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const selectedServer = servers.find((server) => server.uuid === selectedServerUuid) ?? null;
  const selectedStats = selectedServer ? liveStats[selectedServer.uuid] : null;

  const loadServers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [data, eggsData] = await Promise.all([
        api.servers.list(token),
        api.servers.eggs(token),
      ]);
      setServers(data.servers);
      setResources(data.resources);
      setEggs(eggsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Connect WebSocket per server for live stats
  useEffect(() => {
    const token = getAccessToken();
    if (!token || servers.length === 0) return;

    const sockets = socketsRef.current;

    for (const server of servers) {
      if (sockets.has(server.uuid)) continue;
      if (server.suspended) continue;

      api.servers.websocket(token, server.uuid).then((ws) => {
        const wsUrl = typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? ws.url.replace(/^ws:/, 'wss:') : ws.url;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          socket.send(JSON.stringify({ event: 'auth', args: [ws.token] }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'auth success') {
              socket.send(JSON.stringify({ event: 'send stats', args: [null] }));
            } else if (data.event === 'status') {
              const state = data.args?.[0] || data.args;
              setLiveStats((prev) => ({ ...prev, [server.uuid]: { ...(prev[server.uuid] || {}), state } }));
            } else if (data.event === 'stats') {
              const stats = typeof data.args?.[0] === 'string' ? JSON.parse(data.args[0]) : data.args?.[0];
              if (stats) {
                setLiveStats((prev) => ({ ...prev, [server.uuid]: { ...(prev[server.uuid] || {}), ...stats } }));
              }
            } else if (data.event === 'token expiring') {
              api.servers.websocket(token, server.uuid).then((newWs) => {
                socket.send(JSON.stringify({ event: 'auth', args: [newWs.token] }));
              }).catch(() => {});
            }
          } catch { /* ignore */ }
        };

        socket.onclose = () => {
          sockets.delete(server.uuid);
        };

        sockets.set(server.uuid, socket);
      }).catch(() => {
        // Server may not support WS (install failed, etc.)
      });
    }

    return () => {
      for (const [, socket] of sockets) {
        socket.close();
      }
      sockets.clear();
    };
  }, [servers]);


  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-muted-foreground">
            Manage your game servers
            {resources ? ` (${resources.used.servers}/${resources.total.servers} slots used)` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/servers/new">
            <PlusIcon data-icon="inline-start" />
            Create Server
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <ServerIcon className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium">No servers yet</p>
              <p className="text-sm text-muted-foreground">Create your first server to get started.</p>
            </div>
            <Button asChild>
              <Link href="/servers/new">
                <PlusIcon data-icon="inline-start" />
                Create Server
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((server) => (
            <ServerCard
              key={server.uuid}
              server={server}
              liveStats={liveStats[server.uuid] || null}
              eggLogo={eggs.find(e => e.remoteUuid === server.egg?.uuid)?.logo}
              onClick={() => setSelectedServerUuid(server.uuid)}
            />
          ))}
        </div>
      )}

      <Sheet open={Boolean(selectedServer)} onOpenChange={(open) => { if (!open) setSelectedServerUuid(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {selectedServer && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b p-6 pr-16">
                <div className="flex items-center gap-2">
                  <SheetTitle>{selectedServer.name}</SheetTitle>
                  {selectedServer.suspended && <Badge variant="destructive">Suspended</Badge>}
                  <Badge variant="outline" className="text-xs capitalize">{selectedStats?.state ?? selectedServer.status ?? 'offline'}</Badge>
                </div>
                <SheetDescription>
                  {selectedServer.description || 'No server description provided.'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><CpuIcon className="size-3.5" /> CPU Usage</p>
                      <p className="text-lg font-semibold">{selectedStats?.cpu_absolute?.toFixed(1) ?? '0.0'}%</p>
                      <Progress value={Math.min(100, (selectedStats?.cpu_absolute ?? 0) / (selectedServer.limits.cpu || 100) * 100)} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">Limit: {selectedServer.limits.cpu}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MemoryStickIcon className="size-3.5" /> Memory Usage</p>
                      <p className="text-lg font-semibold">{formatBytes(selectedStats?.memory_bytes ?? 0)}</p>
                      <Progress value={Math.min(100, (selectedStats?.memory_bytes ?? 0) / (selectedServer.limits.memory * 1024 * 1024) * 100)} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">Limit: {formatLimit(selectedServer.limits.memory)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><HardDriveIcon className="size-3.5" /> Disk Usage</p>
                      <p className="text-lg font-semibold">{formatBytes(selectedStats?.disk_bytes ?? 0)}</p>
                      <Progress value={Math.min(100, (selectedStats?.disk_bytes ?? 0) / (selectedServer.limits.disk * 1024 * 1024) * 100)} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">Limit: {formatLimit(selectedServer.limits.disk)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2"><ActivityIcon className="size-4" /> Runtime Stats</p>
                      <div className="text-sm space-y-2">
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">State</span> <span className="capitalize">{selectedStats?.state ?? selectedServer.status ?? 'offline'}</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Live CPU</span> <span>{selectedStats?.cpu_absolute?.toFixed(1) ?? '0.0'}%</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Live Memory</span> <span>{formatBytes(selectedStats?.memory_bytes ?? 0)}</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Live Disk</span> <span>{formatBytes(selectedStats?.disk_bytes ?? 0)}</span></p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2"><ShieldIcon className="size-4" /> Server Limits</p>
                      <div className="text-sm space-y-2">
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">CPU</span> <span>{selectedServer.limits.cpu}%</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Memory</span> <span>{formatLimit(selectedServer.limits.memory)}</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Disk</span> <span>{formatLimit(selectedServer.limits.disk)}</span></p>
                        <p className="flex items-center justify-between"><span className="text-muted-foreground">Swap</span> <span>{formatLimit(selectedServer.limits.swap)}</span></p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2"><DatabaseIcon className="size-4" /> Config</p>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-muted-foreground">UUID:</span> {selectedServer.uuid}</p>
                        <p><span className="text-muted-foreground">Short UUID:</span> {selectedServer.uuidShort}</p>
                        <p><span className="text-muted-foreground">Egg:</span> {selectedServer.egg?.name ?? '—'}</p>
                        <p><span className="text-muted-foreground">Node:</span> {selectedServer.node?.name ?? '—'}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2"><NetworkIcon className="size-4" /> Network & Features</p>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-muted-foreground">Allocation:</span> {selectedServer.allocation ? `${selectedServer.allocation.ip}:${selectedServer.allocation.port}` : '—'}</p>
                        <p><span className="text-muted-foreground">Databases:</span> {selectedServer.featureLimits.databases}</p>
                        <p><span className="text-muted-foreground">Backups:</span> {selectedServer.featureLimits.backups}</p>
                        <p><span className="text-muted-foreground">Schedules:</span> {selectedServer.featureLimits.schedules}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="border-t p-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock3Icon className="size-3.5" />
                  Live values update while the server is online.
                </p>
                <Button asChild>
                  <Link href={`/servers/${selectedServer.uuid}`}>
                    Open full server page
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
