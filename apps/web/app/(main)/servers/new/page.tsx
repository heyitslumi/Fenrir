'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import {
  api,
  type EggConfig,
  type LocationConfig,
  type ResourceUsage,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Progress } from '@workspace/ui/components/progress';
import {
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  ArrowLeftIcon,
  RocketIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateServerPage() {
  const { user } = use(AuthenticationContext);
  const router = useRouter();

  const [eggs, setEggs] = useState<EggConfig[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [selectedEgg, setSelectedEgg] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [ram, setRam] = useState(1024);
  const [disk, setDisk] = useState(1024);
  const [cpu, setCpu] = useState(100);
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState('');

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [eggsData, locationsData, serverData] = await Promise.all([
        api.servers.eggs(token),
        api.servers.locations(token),
        api.servers.list(token),
      ]);
      setEggs(eggsData);
      setLocations(locationsData);
      setResources(serverData.resources);
      const firstEgg = eggsData[0];
      const firstLoc = locationsData[0];
      if (firstEgg) {
        setSelectedEgg(firstEgg.name);
        initEnvDefaults(firstEgg);
      }
      if (firstLoc) setSelectedLocation(firstLoc.remoteUuid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentEgg = eggs.find((e) => e.id === selectedEgg);

  const initEnvDefaults = (egg: EggConfig) => {
    const defaults: Record<string, string> = {};
    const vars = Array.isArray(egg.environment) ? egg.environment : [];
    for (const v of vars) {
      if (v.user_editable) {
        defaults[v.env_variable] = v.default_value ?? '';
      }
    }
    setEnvOverrides(defaults);
    // Set default docker image
    const images = egg.dockerImages ?? {};
    const firstUri = Object.values(images)[0];
    setSelectedImage(firstUri ?? egg.dockerImage ?? '');
  };

  const editableVars = Array.isArray(currentEgg?.environment)
    ? currentEgg.environment.filter((v) => v.user_editable && v.user_viewable)
    : [];

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      await api.servers.create(token, {
        name: name.trim(),
        ram,
        disk,
        cpu,
        egg: selectedEgg,
        location: selectedLocation,
        environment: Object.keys(envOverrides).length > 0 ? envOverrides : undefined,
        dockerImage: selectedImage || undefined,
      });
      router.push('/servers');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  // Group eggs by category
  const eggsByCategory = eggs.reduce<Record<string, EggConfig[]>>((acc, egg) => {
    const cat = egg.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(egg);
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/servers">
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Server</h1>
          <p className="text-muted-foreground">Deploy a new server to one of our locations.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Available Resources */}
      {resources && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniResource label="RAM" value={resources.available.ram} unit="MB" />
          <MiniResource label="Disk" value={resources.available.disk} unit="MB" />
          <MiniResource label="CPU" value={resources.available.cpu} unit="%" />
          <MiniResource label="Slots" value={resources.available.servers} unit="" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Server Config */}
        <div className="flex flex-col gap-6">
          {/* Name */}
          <Card>
            <CardHeader>
              <CardTitle>Server Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="My Awesome Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Egg Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Server Type</CardTitle>
              <CardDescription>Choose what software to run.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Object.entries(eggsByCategory).map(([category, catEggs]) => (
                <div key={category}>
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-2">{category}</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {catEggs.map((egg) => (
                      <button
                        key={egg.id}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition hover:border-primary/50 ${
                          selectedEgg === egg.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => {
                          setSelectedEgg(egg.id);
                          setRam(Math.max(ram, egg.minRam));
                          setDisk(Math.max(disk, egg.minDisk));
                          setCpu(Math.max(cpu, egg.minCpu));
                          initEnvDefaults(egg);
                        }}
                      >
                        <span className="font-medium">{egg.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {eggs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No eggs configured. An admin needs to add them in Settings.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Docker Image */}
          {currentEgg && Object.keys(currentEgg.dockerImages ?? {}).length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Docker Image</CardTitle>
                <CardDescription>Select the runtime version.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {Object.entries(currentEgg.dockerImages).map(([label, uri]) => (
                    <button
                      key={uri}
                      className={`rounded-lg border p-3 text-sm font-medium transition hover:border-primary/50 ${
                        selectedImage === uri ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedImage(uri)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Choose where to deploy your server.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition hover:border-primary/50 ${
                      selectedLocation === loc.remoteUuid ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedLocation(loc.remoteUuid)}
                  >
                    {loc.flag && <span className="text-lg">{loc.flag}</span>}
                    <div className="text-left">
                      <p className="font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.short}</p>
                    </div>
                  </button>
                ))}
                {locations.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">
                    No locations configured.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Startup Variables */}
          {editableVars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Startup Variables</CardTitle>
                <CardDescription>Customize your server configuration.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {editableVars.map((v) => (
                  <div key={v.env_variable} className="flex flex-col gap-1.5">
                    <Label htmlFor={`env-${v.env_variable}`}>{v.name}</Label>
                    {v.description && (
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                    )}
                    <Input
                      id={`env-${v.env_variable}`}
                      value={envOverrides[v.env_variable] ?? v.default_value ?? ''}
                      onChange={(e) =>
                        setEnvOverrides((prev) => ({ ...prev, [v.env_variable]: e.target.value }))
                      }
                      placeholder={v.default_value || v.env_variable}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Resources */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Allocate resources for your server.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <SliderField
                label="RAM"
                icon={<MemoryStickIcon className="size-4" />}
                value={ram}
                onChange={setRam}
                min={currentEgg?.minRam ?? 256}
                max={Math.min(currentEgg?.maxRam ?? 8192, resources?.available.ram ?? 8192)}
                step={128}
                unit="MB"
                formatValue={(v) => v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v} MB`}
              />
              <SliderField
                label="Disk"
                icon={<HardDriveIcon className="size-4" />}
                value={disk}
                onChange={setDisk}
                min={currentEgg?.minDisk ?? 256}
                max={Math.min(currentEgg?.maxDisk ?? 10240, resources?.available.disk ?? 10240)}
                step={256}
                unit="MB"
                formatValue={(v) => v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v} MB`}
              />
              <SliderField
                label="CPU"
                icon={<CpuIcon className="size-4" />}
                value={cpu}
                onChange={setCpu}
                min={currentEgg?.minCpu ?? 50}
                max={Math.min(currentEgg?.maxCpu ?? 200, resources?.available.cpu ?? 200)}
                step={25}
                unit="%"
                formatValue={(v) => `${v}%`}
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server Name</span>
                <span className="font-medium">{name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{currentEgg?.displayName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">
                  {locations.find((l) => l.remoteUuid === selectedLocation)?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RAM</span>
                <span className="font-medium">{ram >= 1024 ? `${(ram / 1024).toFixed(1)} GB` : `${ram} MB`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disk</span>
                <span className="font-medium">{disk >= 1024 ? `${(disk / 1024).toFixed(1)} GB` : `${disk} MB`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU</span>
                <span className="font-medium">{cpu}%</span>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !selectedEgg || !selectedLocation}
          >
            <RocketIcon data-icon="inline-start" />
            {creating ? 'Creating...' : 'Deploy Server'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniResource({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label} Available</p>
      <p className="text-lg font-bold">
        {unit === 'MB' ? `${(value / 1024).toFixed(1)} GB` : `${value}${unit}`}
      </p>
    </div>
  );
}

function SliderField({ label, icon, value, onChange, min, max, step, unit, formatValue }: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  formatValue: (v: number) => string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <Label>{label}</Label>
        </div>
        <span className="text-sm font-medium">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}
