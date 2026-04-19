'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type PackageConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon } from 'lucide-react';

const emptyPkg = { name: '', ram: 2048, disk: 3072, cpu: 100, servers: 2, isDefault: false, sortOrder: 0 };

export default function AdminPackagesPage() {
  const { hasRole } = use(AuthenticationContext);
  const [packages, setPackages] = useState<PackageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setPackages(await api.admin.listPackages(token));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ ...emptyPkg }); };
  const startEdit = (pkg: PackageConfig) => { setEditing(pkg.id); setForm({ ...pkg }); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    const token = getAccessToken();
    if (!token) return;
    setMessage(null);
    try {
      if (editing === 'new') {
        await api.admin.createPackage(token, form);
      } else if (editing) {
        await api.admin.updatePackage(token, editing, form);
      }
      setEditing(null);
      load();
      setMessage({ type: 'success', text: 'Package saved' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deletePackage(token, id);
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-muted-foreground">Resource plans assigned to users.</p>
        </div>
        <Button onClick={startNew} disabled={editing !== null}>
          <PlusIcon data-icon="inline-start" /> Add Package
        </Button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Package' : 'Edit Package'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name ?? ''} onChange={(e) => updateForm('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">RAM (MB)</Label>
              <Input type="number" value={form.ram ?? ''} onChange={(e) => updateForm('ram', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Disk (MB)</Label>
              <Input type="number" value={form.disk ?? ''} onChange={(e) => updateForm('disk', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">CPU (%)</Label>
              <Input type="number" value={form.cpu ?? ''} onChange={(e) => updateForm('cpu', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Servers</Label>
              <Input type="number" value={form.servers ?? ''} onChange={(e) => updateForm('servers', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Default Package</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.isDefault ? 'true' : 'false'}
                onChange={(e) => updateForm('isDefault', e.target.value === 'true')}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 justify-end">
              <Button variant="outline" onClick={cancel}><XIcon data-icon="inline-start" /> Cancel</Button>
              <Button onClick={save}><CheckIcon data-icon="inline-start" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {packages.length === 0 && editing === null && (
          <p className="text-muted-foreground text-center py-8">No packages configured yet.</p>
        )}
        {packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{pkg.name}</p>
                  {pkg.isDefault && <Badge>Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  RAM: {pkg.ram} MB · Disk: {pkg.disk} MB · CPU: {pkg.cpu}% · {pkg.servers} servers
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(pkg)} disabled={editing !== null}>
                  <PencilIcon className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(pkg.id)}>
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
