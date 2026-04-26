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
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
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
  const [deployingUuid, setDeployingUuid] = useState<string | null>(null);
  const [deployStep, setDeployStep] = useState(0);

  const [name, setName] = useState('');
  const [selectedEgg, setSelectedEgg] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [ram, setRam] = useState(1024);
  const [disk, setDisk] = useState(1024);
  const [cpu, setCpu] = useState(100);
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState('');

  // Minecraft version picker
  const [mcjarTypes, setMcjarTypes] = useState<Record<string, any>>({});
  const [selectedMcType, setSelectedMcType] = useState('');
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [selectedMcVersion, setSelectedMcVersion] = useState('');
  const [mcBuilds, setMcBuilds] = useState<any[]>([]);
  const [selectedMcBuild, setSelectedMcBuild] = useState('');
  const [mcLoading, setMcLoading] = useState(false);

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [eggsData, locationsData, serverData] = await Promise.all([
        api.servers.eggs(token),
        api.servers.locations(token),
        api.servers.list(token),
      ]);
      const packageId = serverData.resources?.packageId ?? null;
      const visibleEggs = eggsData.filter((egg) => {
        if (!egg.enabled) return false;
        const allowedPackages = Array.isArray(egg.packageIds) ? egg.packageIds : [];
        if (allowedPackages.length === 0) return true;
        return packageId ? allowedPackages.includes(packageId) : false;
      });
      setEggs(visibleEggs);
      setLocations(locationsData);
      setResources(serverData.resources);
      const firstEgg = visibleEggs[0];
      const firstLoc = locationsData[0];
      if (firstEgg) {
        setSelectedEgg(firstEgg.id);
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
  const isMinecraftEgg =
    currentEgg?.type?.toLowerCase() === 'minecraft' ||
    currentEgg?.category?.toLowerCase() === 'minecraft' ||
    /minecraft/i.test(currentEgg?.name ?? '') ||
    /minecraft/i.test(currentEgg?.displayName ?? '');

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

  const allVars = Array.isArray(currentEgg?.environment) ? currentEgg.environment : [];

  // Find egg env vars that represent MC version, build number, or jar/download URL
  // Search all vars (including non-editable) so we can detect and fill them
  const mcVersionVar = allVars.find((v) =>
    /version/i.test(v.name) && !/build/i.test(v.name) && !/url|jar|download/i.test(v.name)
  );
  const mcBuildVar = allVars.find((v) => /build/i.test(v.name) && !/url|jar|download/i.test(v.name));
  // DL_PATH / DOWNLOAD_URL etc — the URL to download the jar from
  const mcJarVar = allVars.find((v) =>
    /download.*path|download.*url/i.test(v.name) ||
    /DL_PATH|DOWNLOAD_URL|JAR_URL/i.test(v.env_variable)
  );
  // SERVER_JARFILE — the filename to save the jar as (e.g. "server.jar")
  const mcJarFileVar = allVars.find((v) =>
    /SERVER_JARFILE/i.test(v.env_variable) || /server.*jar.*file|jar.*file/i.test(v.name)
  );

  // Fetch mcjars types when a Minecraft egg is selected
  useEffect(() => {
    if (!isMinecraftEgg) { setMcjarTypes({}); setSelectedMcType(''); return; }
    fetch('https://mcjars.app/api/v2/types')
      .then((r) => r.json())
      .then((d) => {
        const all: Record<string, any> = {};
        for (const group of Object.values(d.types || d)) {
          if (typeof group === 'object' && !Array.isArray(group)) {
            for (const [k, v] of Object.entries(group as Record<string, any>)) {
              if (!v.deprecated) all[k] = v;
            }
          }
        }
        setMcjarTypes(all);
      })
      .catch(() => {});
  }, [isMinecraftEgg]);

  const [mcVersionsObj, setMcVersionsObj] = useState<Record<string, any>>({});

  // Fetch MC versions when type changes — GET /api/v2/builds/{TYPE} returns object keyed by version
  useEffect(() => {
    if (!selectedMcType) { setMcVersions([]); setMcVersionsObj({}); setSelectedMcVersion(''); setMcBuilds([]); setSelectedMcBuild(''); return; }
    setMcLoading(true);
    fetch(`https://mcjars.app/api/v2/builds/${selectedMcType}`)
      .then((r) => r.json())
      .then((d) => {
        // Response: { builds: { "1.21.4": { latest: {...}, ... }, ... } }
        const versionsObj: Record<string, any> = d.builds ?? {};
        setMcVersionsObj(versionsObj);
        // Sort versions descending (newest first) by keeping stable order from API
        const versions = Object.keys(versionsObj).reverse();
        setMcVersions(versions);
        setSelectedMcVersion('');
        setMcBuilds([]);
        setSelectedMcBuild('');
      })
      .catch(() => {})
      .finally(() => setMcLoading(false));
  }, [selectedMcType]);

  const applyBuildToEnv = (build: any, version: string) => {
    const buildNum = build.buildNumber?.toString() ?? build.id?.toString() ?? '';
    const steps: any[] = build.installation?.[0] ?? [];
    const jarStep = steps.find((s: any) => s.type === 'download');
    const jarUrl = jarStep?.url ?? build.jarUrl ?? '';
    const jarFile = jarStep?.file ?? 'server.jar';
    setSelectedMcBuild(buildNum);
    setEnvOverrides((prev) => {
      const next = { ...prev };
      if (mcVersionVar) next[mcVersionVar.env_variable] = version;
      if (mcBuildVar) next[mcBuildVar.env_variable] = buildNum;
      if (mcJarVar) next[mcJarVar.env_variable] = jarUrl;
      if (mcJarFileVar) next[mcJarFileVar.env_variable] = jarFile;
      return next;
    });
  };

  // Fetch builds when version changes — GET /api/v2/builds/{TYPE}/{VERSION}
  useEffect(() => {
    if (!selectedMcType || !selectedMcVersion) { setMcBuilds([]); setSelectedMcBuild(''); return; }
    setMcLoading(true);
    fetch(`https://mcjars.app/api/v2/builds/${selectedMcType}/${selectedMcVersion}`)
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((d) => {
        const builds: any[] = d?.builds ?? [];
        if (builds.length > 0) {
          setMcBuilds(builds);
          applyBuildToEnv(builds[0], selectedMcVersion);
        } else {
          // Sub-endpoint unavailable (e.g. snapshot versions) — fall back to latest from versions list
          setMcBuilds([]);
          const versionData = mcVersionsObj[selectedMcVersion];
          const latest = versionData?.latest ?? versionData;
          if (latest) applyBuildToEnv(latest, selectedMcVersion);
        }
      })
      .catch(() => {
        setMcBuilds([]);
        const versionData = mcVersionsObj[selectedMcVersion];
        const latest = versionData?.latest ?? versionData;
        if (latest) applyBuildToEnv(latest, selectedMcVersion);
      })
      .finally(() => setMcLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMcType, selectedMcVersion]);

  const DEPLOY_STEPS = [
    'Submitting request',
    'Allocating resources',
    'Pulling Docker image',
    'Running installer',
    'Starting server',
    'Ready',
  ];

  // Poll server status after creation
  useEffect(() => {
    if (!deployingUuid) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    let stepTimer: ReturnType<typeof setTimeout>;

    const advanceStep = (target: number) => {
      setDeployStep((prev) => (prev < target ? target : prev));
    };

    // Simulate early steps immediately
    advanceStep(1);
    stepTimer = setTimeout(() => advanceStep(2), 1500);

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await api.servers.get(token, deployingUuid);
        const status: string = (data?.server?.status as string) ?? '';
        if (status === 'installing') {
          advanceStep(3);
        } else if (!status || status === 'running' || status === 'offline') {
          advanceStep(5);
          setTimeout(() => {
            if (!cancelled) router.push(`/servers/${deployingUuid}`);
          }, 800);
          return;
        } else {
          advanceStep(3);
        }
      } catch { /* keep polling */ }
      if (!cancelled) setTimeout(poll, 2500);
    };

    const initialDelay = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(stepTimer);
      clearTimeout(initialDelay);
    };
  }, [deployingUuid, router]);

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
      const res = await api.servers.create(token, {
        name: name.trim(),
        ram,
        disk,
        cpu,
        egg: selectedEgg,
        location: selectedLocation,
        environment: Object.keys(envOverrides).length > 0 ? envOverrides : undefined,
        dockerImage: selectedImage || undefined,
      });
      setDeployingUuid(res.server.uuid);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  if (deployingUuid) {
    const progressPct = Math.round((deployStep / (DEPLOY_STEPS.length - 1)) * 100);
    const isDone = deployStep >= DEPLOY_STEPS.length - 1;
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              {isDone
                ? <CheckCircle2Icon className="size-12 text-green-500" />
                : <RocketIcon className="size-12 text-primary animate-pulse" />
              }
            </div>
            <CardTitle className="text-xl">{isDone ? 'Server Ready!' : 'Deploying Server'}</CardTitle>
            <CardDescription>
              {isDone ? 'Taking you to your server...' : 'Please wait while your server is being set up.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <Progress value={progressPct} className="h-2" />
            <ol className="space-y-3">
              {DEPLOY_STEPS.map((step, i) => {
                const done = deployStep > i;
                const active = deployStep === i;
                return (
                  <li key={step} className={`flex items-center gap-3 text-sm transition-colors ${done ? 'text-foreground' : active ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {done ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-green-500" />
                    ) : active ? (
                      <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <CircleIcon className="size-4 shrink-0" />
                    )}
                    <span className={active ? 'font-medium' : ''}>{step}</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                        className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition hover:border-primary/50 ${
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
                        {egg.logo ? (
                          <img
                            src={egg.logo}
                            alt={egg.displayName}
                            className="size-10 rounded-md object-contain"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-lg font-bold text-muted-foreground">
                            {egg.displayName.charAt(0)}
                          </div>
                        )}
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

          {/* Minecraft Version Picker */}
          {isMinecraftEgg && Object.keys(mcjarTypes).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Minecraft Version</CardTitle>
                <CardDescription>Select the server software and version.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Type grid */}
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Server Software</p>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {Object.entries(mcjarTypes).map(([key, type]: [string, any]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMcType(key)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition hover:border-primary/50 ${
                          selectedMcType === key ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        {type.icon && (
                          <img src={type.icon} alt={type.name} className="size-7 rounded object-contain" />
                        )}
                        <span>{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Version picker */}
                {selectedMcType && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                      Minecraft Version {mcLoading && <span className="normal-case">(loading…)</span>}
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {mcVersions.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSelectedMcVersion(v)}
                          className={`rounded-md border px-3 py-1 text-xs font-mono transition hover:border-primary/50 ${
                            selectedMcVersion === v ? 'border-primary bg-primary/5 font-bold' : ''
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Build picker — only show if multiple builds for chosen version */}
                {selectedMcVersion && mcBuilds.length > 1 && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Build</p>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedMcBuild}
                      onChange={(e) => {
                        const bid = e.target.value;
                        setSelectedMcBuild(bid);
                        const build = mcBuilds.find((b) => b.buildNumber?.toString() === bid || b.id?.toString() === bid);
                        if (build) applyBuildToEnv(build, selectedMcVersion);
                      }}
                    >
                      {mcBuilds.map((b) => (
                        <option key={b.id} value={b.buildNumber?.toString() ?? b.id?.toString()}>
                          {b.name ?? `Build #${b.buildNumber ?? b.id}`} {b.experimental ? '(experimental)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedMcVersion && mcVersionVar && envOverrides[mcVersionVar.env_variable] && (
                  <p className="text-xs text-muted-foreground truncate">
                    Version set: <span className="font-mono">{envOverrides[mcVersionVar.env_variable]}</span>{mcBuildVar && envOverrides[mcBuildVar.env_variable] ? ` · Build ${envOverrides[mcBuildVar.env_variable]}` : ''}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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
                    {loc.flag && (
                      <img
                        src={`https://flagcdn.com/w40/${loc.flag.toLowerCase()}.png`}
                        alt={loc.flag}
                        className="h-4 w-6 object-cover rounded-sm"
                      />
                    )}
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
                {editableVars.map((v) => {
                  const isManagedByPicker = isMinecraftEgg && selectedMcVersion && (
                    v.env_variable === mcVersionVar?.env_variable ||
                    v.env_variable === mcBuildVar?.env_variable ||
                    v.env_variable === mcJarVar?.env_variable ||
                    v.env_variable === mcJarFileVar?.env_variable
                  );
                  return (
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
                        disabled={!!isManagedByPicker}
                      />
                    </div>
                  );
                })}
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
