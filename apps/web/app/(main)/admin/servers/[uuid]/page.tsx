'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthenticationContext from '@/app/_context/authentication';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import {
  ArrowLeftIcon,
  ServerIcon,
  Loader2Icon,
  TrashIcon,
  PauseIcon,
  PlayIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  GlobeIcon,
  UserIcon,
  SaveIcon,
  PlusIcon,
  XIcon,
  NetworkIcon,
  TerminalIcon,
  InfoIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminServerDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const { hasPermission } = use(AuthenticationContext);

  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Editable state
  const [limits, setLimits] = useState({ memory: 0, disk: 0, cpu: 0, swap: 0, io: 500 });
  const [featureLimits, setFeatureLimits] = useState({ allocations: 0, databases: 0, backups: 0 });
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');

  // Allocations
  const [currentAllocations, setCurrentAllocations] = useState<any[]>([]);
  const [availableAllocations, setAvailableAllocations] = useState<any[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  const parseServer = (raw: any) => {
    const candidates = [
      raw?.server,
      raw?.attributes,
      raw?.data?.attributes,
      raw?.data,
      raw,
    ];
    for (const c of candidates) {
      if (c && c.uuid && c.name) return c;
    }
    return raw?.server ?? raw?.attributes ?? raw?.data ?? raw;
  };

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !uuid) return;
    try {
      setLoading(true);
      setError('');
      const raw = await api.admin.getServer(token, uuid);
      const s = parseServer(raw);
      setServer(s);
      setServerName(s?.name ?? '');
      setServerDescription(s?.description ?? '');
      // Parse current allocations from server data
      const allocs = s?.allocations ?? s?.relationships?.allocations?.data ?? [];
      const primary = s?.allocation;
      if (allocs.length > 0) {
        setCurrentAllocations(allocs.map((a: any) => a.attributes ?? a));
      } else if (primary) {
        setCurrentAllocations([primary]);
      } else {
        setCurrentAllocations([]);
      }
      setLimits({
        memory: s?.limits?.memory ?? 0,
        disk: s?.limits?.disk ?? 0,
        cpu: s?.limits?.cpu ?? 0,
        swap: s?.limits?.swap ?? 0,
        io: s?.limits?.io ?? s?.limits?.io_weight ?? 500,
      });
      setFeatureLimits({
        allocations: s?.feature_limits?.allocations ?? 0,
        databases: s?.feature_limits?.databases ?? 0,
        backups: s?.feature_limits?.backups ?? 0,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token || !server) return;
    try {
      setActionLoading('save');
      setError('');
      setSuccess('');
      await api.admin.updateServer(token, server.uuid, {
        name: serverName,
        description: serverDescription,
        limits,
        feature_limits: featureLimits,
      });
      setSuccess('Server updated successfully');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async () => {
    if (!server) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      setActionLoading('suspend');
      await api.admin.suspendServer(token, server.uuid);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async () => {
    if (!server) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      setActionLoading('unsuspend');
      await api.admin.unsuspendServer(token, server.uuid);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!server) return;
    if (!confirm(`Permanently delete server "${server.name}"? This cannot be undone.`)) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      setActionLoading('delete');
      await api.admin.deleteServer(token, server.uuid);
      router.push('/admin/servers');
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'Server not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/admin/servers"><ArrowLeftIcon className="size-4 mr-1" /> Back</Link>
        </Button>
      </div>
    );
  }

  const canWrite = hasPermission('servers.write');

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/servers"><ArrowLeftIcon className="size-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{server.name}</h1>
            {server.is_suspended ? (
              <Badge variant="destructive">Suspended</Badge>
            ) : (
              <Badge variant="outline">Active</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm font-mono">{server.uuid}</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button size="sm" onClick={handleSave} disabled={!!actionLoading}>
              {actionLoading === 'save' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <SaveIcon className="size-4 mr-1" />}
              Save Changes
            </Button>
          )}
          {hasPermission('servers.write') && (
            server.is_suspended ? (
              <Button variant="outline" size="sm" onClick={handleUnsuspend} disabled={!!actionLoading}>
                {actionLoading === 'unsuspend' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <PlayIcon className="size-4 mr-1" />}
                Unsuspend
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleSuspend} disabled={!!actionLoading}>
                {actionLoading === 'suspend' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <PauseIcon className="size-4 mr-1" />}
                Suspend
              </Button>
            )
          )}
          {hasPermission('servers.delete') && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={!!actionLoading}>
              {actionLoading === 'delete' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <TrashIcon className="size-4 mr-1" />}
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><InfoIcon className="size-4" /> General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Name</label>
              <Input value={serverName} onChange={(e) => setServerName(e.target.value)} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Description</label>
              <Input value={serverDescription} onChange={(e) => setServerDescription(e.target.value)} disabled={!canWrite} placeholder="No description" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">UUID</span>
              <span className="font-mono text-xs">{server.uuid}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Short ID</span>
              <span className="font-mono text-xs">{server.uuid_short ?? server.uuid?.slice(0, 8)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">External ID</span>
              <span className="text-xs">{server.external_id ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="text-xs">{server.created_at ? new Date(server.created_at).toLocaleString() : server.created ? new Date(server.created).toLocaleString() : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Updated</span>
              <span className="text-xs">{server.updated_at ? new Date(server.updated_at).toLocaleString() : server.updated ? new Date(server.updated).toLocaleString() : '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TerminalIcon className="size-4" /> Startup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Startup Command</p>
              <div className="rounded-md bg-muted/50 p-2.5">
                <p className="font-mono text-xs break-all leading-relaxed">{server.startup ?? '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Docker Image</p>
              <div className="rounded-md bg-muted/50 p-2.5">
                <p className="font-mono text-xs break-all">{server.image ?? server.container?.image ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Resource Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CpuIcon className="size-4" /> Resource Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><MemoryStickIcon className="size-3" /> Memory (MB)</label>
              <Input type="number" value={limits.memory} onChange={(e) => setLimits((p) => ({ ...p, memory: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><HardDriveIcon className="size-3" /> Disk (MB)</label>
              <Input type="number" value={limits.disk} onChange={(e) => setLimits((p) => ({ ...p, disk: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><CpuIcon className="size-3" /> CPU (%)</label>
              <Input type="number" value={limits.cpu} onChange={(e) => setLimits((p) => ({ ...p, cpu: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <Separator />
            <div>
              <label className="text-xs text-muted-foreground">Swap (MB)</label>
              <Input type="number" value={limits.swap} onChange={(e) => setLimits((p) => ({ ...p, swap: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">IO Weight</label>
              <Input type="number" value={limits.io} onChange={(e) => setLimits((p) => ({ ...p, io: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
          </CardContent>
        </Card>

        {/* Feature Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ServerIcon className="size-4" /> Feature Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Allocations</label>
              <Input type="number" value={featureLimits.allocations} onChange={(e) => setFeatureLimits((p) => ({ ...p, allocations: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Databases</label>
              <Input type="number" value={featureLimits.databases} onChange={(e) => setFeatureLimits((p) => ({ ...p, databases: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Backups</label>
              <Input type="number" value={featureLimits.backups} onChange={(e) => setFeatureLimits((p) => ({ ...p, backups: parseInt(e.target.value) || 0 }))} disabled={!canWrite} />
            </div>
          </CardContent>
        </Card>

        {/* Connection & Node Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><GlobeIcon className="size-4" /> Connection & Node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {server.node && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Node</span>
                  <span className="font-medium">{server.node.name}</span>
                </div>
                {server.node.fqdn && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">FQDN</span>
                    <span className="font-mono text-xs">{server.node.fqdn}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Node UUID</span>
                  <span className="font-mono text-[10px]">{server.node.uuid?.slice(0, 12)}...</span>
                </div>
                {(server.node.memory || server.node.disk) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Node Capacity</span>
                    <span className="text-xs">{server.node.memory ? `${server.node.memory}MB RAM` : ''}{server.node.memory && server.node.disk ? ' · ' : ''}{server.node.disk ? `${server.node.disk}MB Disk` : ''}</span>
                  </div>
                )}
                <Separator />
              </>
            )}
            {server.allocation && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Primary Address</span>
                <span className="font-medium font-mono text-xs">{server.allocation.ip}:{server.allocation.port}</span>
              </div>
            )}
            {server.egg && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Egg</span>
                  <span className="font-medium">{server.egg.name}</span>
                </div>
                {server.egg.uuid && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Egg UUID</span>
                    <span className="font-mono text-[10px]">{server.egg.uuid?.slice(0, 12)}...</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><NetworkIcon className="size-4" /> Allocations</CardTitle>
            {canWrite && server.node && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (showAvailable) {
                    setShowAvailable(false);
                    return;
                  }
                  const token = getAccessToken();
                  if (!token) return;
                  setAllocationsLoading(true);
                  try {
                    const nodeUuid = server.node.uuid;
                    const allocs = await api.admin.listNodeAllocations(token, server.uuid, nodeUuid);
                    const usedUuids = new Set(currentAllocations.map((a: any) => a.uuid));
                    setAvailableAllocations((allocs || []).filter((a: any) => !a.server_uuid && !usedUuids.has(a.uuid)));
                    setShowAvailable(true);
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setAllocationsLoading(false);
                  }
                }}
                disabled={allocationsLoading}
              >
                {allocationsLoading ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <PlusIcon className="size-4 mr-1" />}
                {showAvailable ? 'Hide' : 'Add Allocation'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentAllocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No allocations</p>
          ) : (
            <div className="space-y-2">
              {currentAllocations.map((a: any) => (
                <div key={a.uuid} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{a.ip}:{a.port}</span>
                    {a.is_primary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                    {a.notes && <span className="text-xs text-muted-foreground">{a.notes}</span>}
                  </div>
                  {canWrite && !a.is_primary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        const token = getAccessToken();
                        if (!token) return;
                        try {
                          setActionLoading('alloc-remove');
                          const remaining = currentAllocations.filter((c: any) => c.uuid !== a.uuid).map((c: any) => c.uuid);
                          await api.admin.updateServer(token, server.uuid, { remove_allocations: [a.uuid] });
                          setCurrentAllocations((prev) => prev.filter((c: any) => c.uuid !== a.uuid));
                        } catch (err: any) {
                          setError(err.message);
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={!!actionLoading}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showAvailable && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Available allocations on this node:</p>
              {availableAllocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No free allocations on this node</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableAllocations.map((a: any) => (
                    <div key={a.uuid} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span className="font-mono">{a.ip}:{a.port}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const token = getAccessToken();
                          if (!token) return;
                          try {
                            setActionLoading('alloc-add');
                            await api.admin.updateServer(token, server.uuid, { add_allocations: [a.uuid] });
                            setCurrentAllocations((prev) => [...prev, a]);
                            setAvailableAllocations((prev) => prev.filter((x: any) => x.uuid !== a.uuid));
                          } catch (err: any) {
                            setError(err.message);
                          } finally {
                            setActionLoading(null);
                          }
                        }}
                        disabled={!!actionLoading}
                      >
                        <PlusIcon className="size-3 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Owner */}
      {server.user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserIcon className="size-4" /> Owner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {(server.user.username || server.user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{server.user.username || '—'}</p>
                  <p className="text-xs text-muted-foreground">{server.user.email}</p>
                  {server.user.uuid && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{server.user.uuid}</p>
                  )}
                </div>
              </div>
              {server.user.uuid && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/users/${server.user.uuid}`}>View User</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment Variables */}
      {(server.environment || server.container?.environment) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TerminalIcon className="size-4" /> Environment Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-xs">Variable</th>
                    <th className="px-3 py-2 text-left font-medium text-xs">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(server.environment ?? server.container?.environment ?? {}).map(([key, val]) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{key}</td>
                      <td className="px-3 py-1.5 font-mono text-xs break-all">{String(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
