'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type EggConfig, type PackageConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon } from 'lucide-react';

interface EggFull extends EggConfig {
  dockerImage: string;
  startup: string;
  environment: any;
  featureLimits: any;
  free: boolean;
  sortOrder: number;
}

const emptyEgg: Omit<EggFull, 'id'> = {
  name: '', displayName: '', category: 'Game Servers', type: '', logo: null,
  enabled: true, packageIds: [],
  free: true, remoteUuid: '', nestUuid: '', dockerImage: '', dockerImages: {},
  startup: '', environment: {},
  featureLimits: { databases: 0, backups: 1, allocations: 1, schedules: 0 },
  minRam: 256, minDisk: 256, minCpu: 50,
  maxRam: 8192, maxDisk: 10240, maxCpu: 200, sortOrder: 0,
};

export default function AdminEggsPage() {
  const { hasRole } = use(AuthenticationContext);
  const [eggs, setEggs] = useState<EggFull[]>([]);
  const [packages, setPackages] = useState<PackageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.admin.listEggs(token) as EggFull[];
      const packagesData = await api.admin.listPackages(token);
      setEggs(data);
      setPackages(packagesData);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ ...emptyEgg }); };
  const startEdit = (egg: EggFull) => { setEditing(egg.id); setForm({ ...egg }); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    const token = getAccessToken();
    if (!token) return;
    setMessage(null);
    try {
      if (editing === 'new') {
        await api.admin.createEgg(token, form);
      } else if (editing) {
        await api.admin.updateEgg(token, editing, form);
      }
      setEditing(null);
      load();
      setMessage({ type: 'success', text: 'Egg saved' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this egg?')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deleteEgg(token, id);
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eggs</h1>
          <p className="text-muted-foreground">Server templates that users can deploy.</p>
        </div>
        <Button onClick={startNew} disabled={editing !== null}>
          <PlusIcon data-icon="inline-start" /> Add Egg
        </Button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Egg' : 'Edit Egg'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Name (slug)" value={form.name} onChange={(v) => updateForm('name', v)} />
            <Field label="Display Name" value={form.displayName} onChange={(v) => updateForm('displayName', v)} />
            <Field label="Category" value={form.category} onChange={(v) => updateForm('category', v)} />
            <Field label="Type (e.g. minecraft)" value={form.type ?? ''} onChange={(v) => updateForm('type', v)} />
            <Field label="Nest UUID (Calagopus)" value={form.nestUuid} onChange={(v) => updateForm('nestUuid', v)} />
            <Field label="Egg UUID (Calagopus)" value={form.remoteUuid} onChange={(v) => updateForm('remoteUuid', v)} />
            <Field label="Docker Image" value={form.dockerImage} onChange={(v) => updateForm('dockerImage', v)} />
            <Field label="Startup Command" value={form.startup} onChange={(v) => updateForm('startup', v)} />
            <Field label="Min RAM (MB)" value={form.minRam} onChange={(v) => updateForm('minRam', parseInt(v) || 0)} type="number" />
            <Field label="Max RAM (MB)" value={form.maxRam} onChange={(v) => updateForm('maxRam', parseInt(v) || 0)} type="number" />
            <Field label="Min Disk (MB)" value={form.minDisk} onChange={(v) => updateForm('minDisk', parseInt(v) || 0)} type="number" />
            <Field label="Max Disk (MB)" value={form.maxDisk} onChange={(v) => updateForm('maxDisk', parseInt(v) || 0)} type="number" />
            <Field label="Min CPU (%)" value={form.minCpu} onChange={(v) => updateForm('minCpu', parseInt(v) || 0)} type="number" />
            <Field label="Max CPU (%)" value={form.maxCpu} onChange={(v) => updateForm('maxCpu', parseInt(v) || 0)} type="number" />
            <Field label="Image URL" value={form.logo} onChange={(v) => updateForm('logo', v)} />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Enabled</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.enabled ? 'true' : 'false'}
                onChange={(e) => updateForm('enabled', e.target.value === 'true')}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <Field label="Sort Order" value={form.sortOrder} onChange={(v) => updateForm('sortOrder', parseInt(v) || 0)} type="number" />
            <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-2">
              <Label className="text-xs">Limit to Packages (optional)</Label>
              <p className="text-xs text-muted-foreground">Leave all unchecked to make this egg available for every package.</p>
              <div className="grid gap-2 md:grid-cols-2">
                {packages.map((pkg) => {
                  const current = Array.isArray(form.packageIds) ? form.packageIds : [];
                  const checked = current.includes(pkg.id);
                  return (
                    <label key={pkg.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) updateForm('packageIds', [...current, pkg.id]);
                          else updateForm('packageIds', current.filter((id: string) => id !== pkg.id));
                        }}
                      />
                      <span>{pkg.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 justify-end">
              <Button variant="outline" onClick={cancel}><XIcon data-icon="inline-start" /> Cancel</Button>
              <Button onClick={save}><CheckIcon data-icon="inline-start" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {eggs.length === 0 && editing === null && (
        <p className="text-muted-foreground text-center py-8">No eggs configured yet.</p>
      )}

      {eggs.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10"></th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">UUID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">RAM</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Disk</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">CPU</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {eggs.map((egg) => (
                <tr key={egg.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {egg.logo ? (
                      <img src={egg.logo} alt={egg.displayName} className="size-8 rounded-md object-contain" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground">
                        {egg.displayName.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{egg.displayName}</p>
                      {!egg.enabled && <Badge variant="outline">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{egg.name}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="secondary">{egg.category}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-mono text-xs text-muted-foreground">{egg.remoteUuid.slice(0, 12)}…</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {egg.minRam}–{egg.maxRam} MB
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {egg.minDisk}–{egg.maxDisk} MB
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {egg.minCpu}–{egg.maxCpu}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(egg)} disabled={editing !== null}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(egg.id)}>
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
