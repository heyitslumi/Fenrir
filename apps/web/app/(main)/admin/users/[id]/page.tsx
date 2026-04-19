'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type AdminUserDetail, type AdminRole } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import {
  ArrowLeftIcon,
  ShieldIcon,
  UserIcon,
  CoinsIcon,
  PackageIcon,
  ServerIcon,
  Loader2Icon,
  TrashIcon,
  SaveIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser, hasPermission } = use(AuthenticationContext);

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [editCoins, setEditCoins] = useState('');
  const [editResources, setEditResources] = useState({
    extraRam: 0,
    extraDisk: 0,
    extraCpu: 0,
    extraServers: 0,
  });

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    try {
      setLoading(true);
      setError('');
      const [userData, rolesData, pkgData] = await Promise.all([
        api.admin.getUserDetail(token, id),
        api.admin.listRoles(token),
        api.admin.listPackages(token),
      ]);
      setDetail(userData);
      setEditCoins(String(userData.resources?.coins ?? 0));
      setEditResources({
        extraRam: userData.resources?.extraRam ?? 0,
        extraDisk: userData.resources?.extraDisk ?? 0,
        extraCpu: userData.resources?.extraCpu ?? 0,
        extraServers: userData.resources?.extraServers ?? 0,
      });
      setRoles(rolesData);
      setPackages(pkgData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSetCoins = async () => {
    const token = getAccessToken();
    if (!token || !detail) return;
    try {
      setActionLoading('coins');
      await api.admin.setUserCoins(token, detail.id, parseFloat(editCoins) || 0);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetResources = async () => {
    const token = getAccessToken();
    if (!token || !detail) return;
    try {
      setActionLoading('resources');
      await api.admin.updateUserResources(token, detail.id, editResources);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (roleId: string) => {
    const token = getAccessToken();
    if (!token || !detail) return;
    try {
      setActionLoading('role');
      await api.admin.setUserRole(token, detail.id, roleId);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPackage = async (packageId: string | null) => {
    const token = getAccessToken();
    if (!token || !detail) return;
    try {
      setActionLoading('package');
      await api.admin.setUserPackage(token, detail.id, packageId);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!confirm(`Permanently delete user "${detail.name || detail.email}"? This cannot be undone.`)) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      setActionLoading('delete');
      await api.users.delete(token, detail.id);
      router.push('/admin/users');
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

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'User not found'}</p>
        <Button variant="outline" asChild><Link href="/admin/users"><ArrowLeftIcon className="size-4 mr-1" /> Back</Link></Button>
      </div>
    );
  }

  const isSelf = detail.id === currentUser?.id;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users"><ArrowLeftIcon className="size-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{detail.name || detail.email}</h1>
          <p className="text-muted-foreground text-sm">{detail.email} · Joined {new Date(detail.createdAt).toLocaleDateString()}</p>
        </div>
        {hasPermission('users.delete') && !isSelf && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={actionLoading === 'delete'}>
            {actionLoading === 'delete' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <TrashIcon className="size-4 mr-1" />}
            Delete User
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldIcon className="size-4" /> Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <Button
                  key={r.id}
                  variant={detail.roleId === r.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSetRole(r.id)}
                  disabled={actionLoading === 'role' || isSelf}
                >
                  {r.name}
                </Button>
              ))}
            </div>
            {isSelf && <p className="text-xs text-muted-foreground mt-2">Cannot change your own role</p>}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Current permissions:</p>
              <div className="flex flex-wrap gap-1">
                {detail.permissions.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CoinsIcon className="size-4" /> Coins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editCoins}
                onChange={(e) => setEditCoins(e.target.value)}
                className="w-40"
              />
              <Button size="sm" onClick={handleSetCoins} disabled={actionLoading === 'coins'}>
                {actionLoading === 'coins' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <SaveIcon className="size-4 mr-1" />}
                Set
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Current: {detail.resources?.coins ?? 0} coins</p>
          </CardContent>
        </Card>

        {/* Package */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><PackageIcon className="size-4" /> Package</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!detail.resources?.packageId ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSetPackage(null)}
                disabled={actionLoading === 'package'}
              >
                None (Default)
              </Button>
              {packages.map((pkg) => (
                <Button
                  key={pkg.id}
                  variant={detail.resources?.packageId === pkg.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSetPackage(pkg.id)}
                  disabled={actionLoading === 'package'}
                >
                  {pkg.name}
                </Button>
              ))}
            </div>
            {detail.resources?.package && (
              <p className="text-xs text-muted-foreground mt-2">
                Package limits: {detail.resources.package.ram}MB RAM · {detail.resources.package.disk}MB Disk · {detail.resources.package.cpu}% CPU · {detail.resources.package.servers} Servers
              </p>
            )}
          </CardContent>
        </Card>

        {/* Extra Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extra Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">RAM (MB)</label>
                <Input
                  type="number"
                  value={editResources.extraRam}
                  onChange={(e) => setEditResources((prev) => ({ ...prev, extraRam: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Disk (MB)</label>
                <Input
                  type="number"
                  value={editResources.extraDisk}
                  onChange={(e) => setEditResources((prev) => ({ ...prev, extraDisk: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CPU (%)</label>
                <Input
                  type="number"
                  value={editResources.extraCpu}
                  onChange={(e) => setEditResources((prev) => ({ ...prev, extraCpu: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Servers</label>
                <Input
                  type="number"
                  value={editResources.extraServers}
                  onChange={(e) => setEditResources((prev) => ({ ...prev, extraServers: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <Button size="sm" className="mt-3" onClick={handleSetResources} disabled={actionLoading === 'resources'}>
              {actionLoading === 'resources' ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <SaveIcon className="size-4 mr-1" />}
              Save Resources
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Servers */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><ServerIcon className="size-5" /> Servers ({detail.servers.length})</h2>
        {detail.servers.length === 0 ? (
          <p className="text-sm text-muted-foreground">This user has no servers.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">UUID</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Resources</th>
                </tr>
              </thead>
              <tbody>
                {detail.servers.map((s) => (
                  <tr key={s.uuid} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{s.uuid.slice(0, 12)}</td>
                    <td className="px-4 py-2">
                      {s.suspended ? (
                        <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {s.limits.memory}MB · {s.limits.disk}MB · {s.limits.cpu}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
