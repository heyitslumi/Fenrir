'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import {
  api,
  type EggConfig,
  type LocationConfig,
  type NodeConfig,
  type SyncResult,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import {
  RefreshCwIcon,
  MapPinIcon,
  ServerIcon,
  EggIcon,
  NetworkIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from 'lucide-react';

export default function AdminSyncPage() {
  const { hasRole } = use(AuthenticationContext);
  const [eggs, setEggs] = useState<EggConfig[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [nodes, setNodes] = useState<NodeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [e, l, n] = await Promise.all([
        api.admin.listEggs(token),
        api.admin.listLocations(token),
        api.admin.listNodes(token),
      ]);
      setEggs(e);
      setLocations(l);
      setNodes(n);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncAll = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSyncing('all');
    setError('');
    setResult(null);
    try {
      const res = await api.admin.syncAll(token);
      setResult(res);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncOne = async (type: 'locations' | 'nodes' | 'eggs') => {
    const token = getAccessToken();
    if (!token) return;
    setSyncing(type);
    setError('');
    setResult(null);
    try {
      if (type === 'locations') await api.admin.syncLocations(token);
      else if (type === 'nodes') await api.admin.syncNodes(token);
      else await api.admin.syncEggs(token);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(null);
    }
  };

  if (!hasRole('admin')) {
    return <div className="p-6 text-muted-foreground">Access denied.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync with Calagopus</h1>
          <p className="text-muted-foreground">
            Pull eggs, nests, locations, and nodes from your Calagopus panel.
          </p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing !== null}>
          {syncing === 'all' ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          {syncing === 'all' ? 'Syncing...' : 'Sync All'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {result && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2Icon className="size-5 text-emerald-500" />
              <p className="font-medium text-emerald-600">Sync complete</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">Locations</p>
                <p className="text-muted-foreground">
                  {result.locations.synced} found · {result.locations.created} created · {result.locations.updated} updated
                </p>
              </div>
              <div>
                <p className="font-medium">Nodes</p>
                <p className="text-muted-foreground">
                  {result.nodes.synced} found · {result.nodes.created} created · {result.nodes.updated} updated
                </p>
              </div>
              <div>
                <p className="font-medium">Eggs</p>
                <p className="text-muted-foreground">
                  {result.eggs.nests} nests · {result.eggs.eggs} eggs · {result.eggs.created} created · {result.eggs.updated} updated
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Locations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">Locations</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncOne('locations')}
                disabled={syncing !== null}
              >
                {syncing === 'locations' ? <Loader2Icon className="size-3 animate-spin" /> : <RefreshCwIcon className="size-3" />}
              </Button>
            </div>
            <CardDescription>{locations.length} synced</CardDescription>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations synced yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      {loc.flag && <span>{loc.flag}</span>}
                      <span className="font-medium">{loc.name}</span>
                    </div>
                    <Badge variant="outline">{loc.short}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nodes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NetworkIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">Nodes</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncOne('nodes')}
                disabled={syncing !== null}
              >
                {syncing === 'nodes' ? <Loader2Icon className="size-3 animate-spin" /> : <RefreshCwIcon className="size-3" />}
              </Button>
            </div>
            <CardDescription>{nodes.length} synced</CardDescription>
          </CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nodes synced yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {nodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{node.name}</p>
                      <p className="text-xs text-muted-foreground">{node.fqdn}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{node.memory > 0 ? `${(node.memory / 1024).toFixed(1)} GB RAM` : '—'}</p>
                      <p>{node.disk > 0 ? `${(node.disk / 1024).toFixed(1)} GB Disk` : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eggs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EggIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">Eggs</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncOne('eggs')}
                disabled={syncing !== null}
              >
                {syncing === 'eggs' ? <Loader2Icon className="size-3 animate-spin" /> : <RefreshCwIcon className="size-3" />}
              </Button>
            </div>
            <CardDescription>{eggs.length} synced</CardDescription>
          </CardHeader>
          <CardContent>
            {eggs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eggs synced yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {eggs.map((egg) => (
                  <div key={egg.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{egg.displayName}</p>
                      <p className="text-xs text-muted-foreground">{egg.category}</p>
                    </div>
                    <Badge variant="secondary">{egg.name}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
