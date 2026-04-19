'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type PanelStats, type ResourceUsage } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Progress } from '@workspace/ui/components/progress';
import {
  ServerIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  UsersIcon,
  MapPinIcon,
  NetworkIcon,
  GiftIcon,
  PlusIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = use(AuthenticationContext);
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [stats, setStats] = useState<PanelStats | null>(null);
  const [dailyAvailable, setDailyAvailable] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [serverData, statsData, dailyData] = await Promise.all([
        cachedFetch('dashboard:servers', () => api.servers.list(token), 30 * 1000).catch(() => null),
        cachedFetch('dashboard:stats', () => api.servers.stats(token), 60 * 1000).catch(() => null),
        cachedFetch('dashboard:daily', () => api.store.dailyStatus(token), 30 * 1000).catch(() => null),
      ]);
      if (serverData) setResources(serverData.resources);
      if (statsData) setStats(statsData);
      if (dailyData) setDailyAvailable(dailyData.available);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClaimDaily = async () => {
    const token = getAccessToken();
    if (!token) return;
    setClaimingDaily(true);
    try {
      await api.store.claimDaily(token);
      setDailyAvailable(false);
      invalidateCache('dashboard:daily');
      invalidateCache('dashboard:servers');
      invalidateCache('coins');
      loadData();
    } catch { /* ignore */ }
    setClaimingDaily(false);
  };

  const pct = (used: number, total: number) => (total > 0 ? Math.min(100, (used / total) * 100) : 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/servers/new">
            <PlusIcon data-icon="inline-start" />
            New Server
          </Link>
        </Button>
      </div>

      {/* Daily Coins Banner */}
      {dailyAvailable && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <GiftIcon className="size-5 text-primary" />
              <div>
                <p className="font-medium">Daily Reward Available</p>
                <p className="text-sm text-muted-foreground">Claim your free coins!</p>
              </div>
            </div>
            <Button size="sm" onClick={handleClaimDaily} disabled={claimingDaily}>
              {claimingDaily ? 'Claiming...' : 'Claim'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Welcome + Resources Row */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Welcome Card */}
        <Card className="flex-1 border-l-4 border-l-primary">
          <CardContent className="flex flex-col justify-between p-6 h-full">
            <div>
              <h2 className="text-lg font-semibold">
                Welcome to the panel{user?.name ? `, ${user.name}` : ''}!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your servers, purchase resources, and more. Need help? Join our Discord.
              </p>
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/servers/new">Get Started</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resource Cards */}
        <div className="grid flex-[2] grid-cols-2 gap-4">
          <ResourceCard
            label="Memory"
            icon={<MemoryStickIcon className="size-4 text-muted-foreground" />}
            used={resources?.used.ram ?? 0}
            total={resources?.total.ram ?? 0}
            unit="MB"
          />
          <ResourceCard
            label="CPU"
            icon={<CpuIcon className="size-4 text-muted-foreground" />}
            used={resources?.used.cpu ?? 0}
            total={resources?.total.cpu ?? 0}
            unit="%"
          />
          <ResourceCard
            label="Disk"
            icon={<HardDriveIcon className="size-4 text-muted-foreground" />}
            used={resources?.used.disk ?? 0}
            total={resources?.total.disk ?? 0}
            unit="MB"
          />
          <ResourceCard
            label="Servers"
            icon={<ServerIcon className="size-4 text-muted-foreground" />}
            used={resources?.used.servers ?? 0}
            total={resources?.total.servers ?? 0}
            unit=""
          />
        </div>
      </div>

      {/* Platform Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Platform Statistics</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Users" value={stats?.users ?? '—'} icon={<UsersIcon className="size-4 text-muted-foreground" />} />
          <StatCard label="Active Servers" value={stats?.servers ?? '—'} icon={<ServerIcon className="size-4 text-muted-foreground" />} />
          <StatCard label="Nodes" value={stats?.nodes ?? '—'} icon={<NetworkIcon className="size-4 text-muted-foreground" />} />
          <StatCard label="Locations" value={stats?.locations ?? '—'} icon={<MapPinIcon className="size-4 text-muted-foreground" />} />
        </div>
      </div>

      {/* Coins */}
      {resources && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-bold">{resources.coins.toFixed(2)} coins</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/store">Visit Store</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResourceCard({ label, icon, used, total, unit }: {
  label: string;
  icon: React.ReactNode;
  used: number;
  total: number;
  unit: string;
}) {
  const pctValue = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const available = total - used;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-bold">
          {unit === 'MB' ? `${(available / 1024).toFixed(1)} GB` : unit === '' ? available : `${available}${unit}`}
        </p>
        <Progress value={pctValue} className="mt-2 h-1.5" />
        <p className="mt-1 text-xs text-muted-foreground">
          {unit === 'MB' ? `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB` : unit === '' ? `${used} / ${total}` : `${used} / ${total}${unit}`} used
        </p>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
