"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CoinsIcon,
  CpuIcon,
  GiftIcon,
  HardDriveIcon,
  MapPinIcon,
  MemoryStickIcon,
  NetworkIcon,
  PlusIcon,
  ServerIcon,
  UsersIcon,
} from "lucide-react"
import AuthenticationContext from "@/app/_context/authentication"
import { api, type BrandConfig, type PanelStats, type ResourceUsage } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { cachedFetch, invalidateCache } from "@/lib/cache"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import Script from "next/script"

export default function DashboardPage() {
  const { user } = use(AuthenticationContext)
  const [resources, setResources] = useState<ResourceUsage | null>(null)
  const [stats, setStats] = useState<PanelStats | null>(null)
  const [planName, setPlanName] = useState<string>("Default")
  const [brand, setBrand] = useState<BrandConfig>({})
  const [dailyAvailable, setDailyAvailable] = useState(false)
  const [claimingDaily, setClaimingDaily] = useState(false)

  const loadData = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return

    try {
      const [serverData, statsData, dailyData, storeResources, brandData] = await Promise.all([
        cachedFetch(
          "dashboard:servers",
          () => api.servers.list(token),
          30 * 1000
        ).catch(() => null),
        cachedFetch(
          "dashboard:stats",
          () => api.servers.stats(token),
          60 * 1000
        ).catch(() => null),
        cachedFetch(
          "dashboard:daily",
          () => api.store.dailyStatus(token),
          30 * 1000
        ).catch(() => null),
        cachedFetch(
          "dashboard:store-resources",
          () => api.store.resources(token),
          60 * 1000,
        ).catch(() => null),
        cachedFetch("brand", () => api.settings.getBrand(), 5 * 60 * 1000).catch(() => null),
      ])

      if (serverData) setResources(serverData.resources)
      if (statsData) setStats(statsData)
      if (dailyData) setDailyAvailable(dailyData.available)
      if (storeResources) setPlanName(storeResources.package?.name ?? "Default")
      if (brandData) setBrand(brandData)
    } catch {
      // ignore dashboard fetch failures to keep page responsive
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (brand["ads.enabled"] !== "true") return
    if (!(window as any).adsbygoogle) return
    try {
      ;(window as any).adsbygoogle.push({})
    } catch {
      // ignore ad provider script errors
    }
  }, [brand])

  const handleClaimDaily = async () => {
    const token = getAccessToken()
    if (!token) return

    setClaimingDaily(true)
    try {
      await api.store.claimDaily(token)
      setDailyAvailable(false)
      invalidateCache("dashboard:daily")
      invalidateCache("dashboard:servers")
      invalidateCache("coins")
      loadData()
    } catch {
      // ignore claim failures and keep existing state
    }
    setClaimingDaily(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""}.
          </p>
        </div>
        <Button asChild>
          <Link href="/servers/new">
            <PlusIcon data-icon="inline-start" />
            Deploy Server
          </Link>
        </Button>
      </div>

      {dailyAvailable && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <GiftIcon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Daily reward ready to claim
                </p>
                <p className="text-xs text-muted-foreground">
                  Pick up your free coins for today.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleClaimDaily}
              disabled={claimingDaily}
            >
              {claimingDaily ? "Claiming…" : "Claim Daily"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Platform Statistics</CardTitle>
            <CardDescription>
              Current activity across your panel infrastructure.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total Users"
              value={stats?.users ?? "—"}
              icon={<UsersIcon className="size-4 text-muted-foreground" />}
            />
            <StatCard
              label="Active Servers"
              value={stats?.servers ?? "—"}
              icon={<ServerIcon className="size-4 text-muted-foreground" />}
            />
            <StatCard
              label="Nodes"
              value={stats?.nodes ?? "—"}
              icon={<NetworkIcon className="size-4 text-muted-foreground" />}
            />
            <StatCard
              label="Locations"
              value={stats?.locations ?? "—"}
              icon={<MapPinIcon className="size-4 text-muted-foreground" />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CoinsIcon className="size-4" />
              Wallet
            </CardTitle>
            <CardDescription>
              Spend coins to scale servers or buy extra resources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline" className="text-xs">
              Plan: {planName}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Available balance
            </Badge>
            <p className="text-3xl font-semibold">
              {resources ? `${resources.coins.toFixed(2)} coins` : "—"}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/store">Open Store</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {brand["ads.enabled"] === "true" && brand["ads.client"] && brand["ads.slot"] && (
        <Card>
          <CardHeader>
            <CardTitle>Sponsored</CardTitle>
            <CardDescription>Advertisement</CardDescription>
          </CardHeader>
          <CardContent>
            <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${brand["ads.client"]}`} crossOrigin="anonymous" strategy="afterInteractive" />
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client={brand["ads.client"]}
              data-ad-slot={brand["ads.slot"]}
              data-ad-format={brand["ads.format"] || "auto"}
              data-full-width-responsive="true"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResourceCard({
  label,
  icon,
  used,
  total,
  unit,
}: {
  label: string
  icon: React.ReactNode
  used: number
  total: number
  unit: string
}) {
  const usagePercent = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const available = Math.max(total - used, 0)

  const valueLabel =
    unit === "MB"
      ? `${(available / 1024).toFixed(1)} GB free`
      : unit === ""
        ? `${available} free`
        : `${available}${unit} free`

  const usageLabel =
    unit === "MB"
      ? `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB used`
      : unit === ""
        ? `${used} / ${total} used`
        : `${used} / ${total}${unit} used`

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-2xl font-semibold tracking-tight">{valueLabel}</p>
        <Progress value={usagePercent} className="h-1.5" />
        <p className="text-xs text-muted-foreground">{usageLabel}</p>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
