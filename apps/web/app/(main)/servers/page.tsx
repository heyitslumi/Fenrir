'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type ServerItem, type ResourceUsage } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { Progress } from '@workspace/ui/components/progress';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  ServerIcon,
  PlusIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
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

function ServerCard({ server, liveStats }: {
  server: ServerItem;
  liveStats: LiveStats | null;
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
    <Link href={`/servers/${server.uuid}`}>
      <Card className="group hover:border-primary/20 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`size-2.5 rounded-full ${statusColor} ${state === 'running' ? 'animate-pulse' : ''}`} />
              <ServerIcon className="size-5 text-muted-foreground" />
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
    </Link>
  );
}

export default function ServersPage() {
  const { user } = use(AuthenticationContext);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStats, setLiveStats] = useState<Record<string, LiveStats>>({});
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());

  const loadServers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.servers.list(token);
      setServers(data.servers);
      setResources(data.resources);
    } catch (err: any) {
      setError(err.message);
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
