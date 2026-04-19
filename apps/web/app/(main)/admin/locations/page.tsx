'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type LocationConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon } from 'lucide-react';

const emptyLoc = { remoteUuid: '', name: '', short: '', country: '', flag: '' };

export default function AdminLocationsPage() {
  const { hasRole } = use(AuthenticationContext);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLocations(await api.admin.listLocations(token));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ ...emptyLoc }); };
  const startEdit = (loc: LocationConfig) => { setEditing(loc.id); setForm({ ...loc }); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    const token = getAccessToken();
    if (!token) return;
    setMessage(null);
    try {
      if (editing === 'new') {
        await api.admin.createLocation(token, form);
      } else if (editing) {
        await api.admin.updateLocation(token, editing, form);
      }
      setEditing(null);
      load();
      setMessage({ type: 'success', text: 'Location saved' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deleteLocation(token, id);
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Server deployment locations (must match Calagopus location UUIDs).</p>
        </div>
        <Button onClick={startNew} disabled={editing !== null}>
          <PlusIcon data-icon="inline-start" /> Add Location
        </Button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Location' : 'Edit Location'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Remote UUID (Calagopus)</Label>
              <Input value={form.remoteUuid ?? ''} onChange={(e) => updateForm('remoteUuid', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name ?? ''} onChange={(e) => updateForm('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Short Code</Label>
              <Input placeholder="us-east" value={form.short ?? ''} onChange={(e) => updateForm('short', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Country</Label>
              <Input placeholder="United States" value={form.country ?? ''} onChange={(e) => updateForm('country', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Flag Emoji</Label>
              <Input placeholder="🇺🇸" value={form.flag ?? ''} onChange={(e) => updateForm('flag', e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={cancel}><XIcon data-icon="inline-start" /> Cancel</Button>
              <Button onClick={save}><CheckIcon data-icon="inline-start" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {locations.length === 0 && editing === null && (
          <p className="text-muted-foreground text-center py-8">No locations configured yet.</p>
        )}
        {locations.map((loc) => (
          <Card key={loc.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {loc.flag && <span className="text-2xl">{loc.flag}</span>}
                <div>
                  <p className="font-medium">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">{loc.remoteUuid.slice(0, 8)}... · {loc.short}{loc.country ? ` · ${loc.country}` : ''}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(loc)} disabled={editing !== null}>
                  <PencilIcon className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(loc.id)}>
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
