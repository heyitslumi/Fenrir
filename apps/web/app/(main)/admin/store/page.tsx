'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type StoreItem } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon } from 'lucide-react';

const emptyItem = { resource: '', cost: 100, per: 1, limit: 1, enabled: true };

export default function AdminStorePage() {
  use(AuthenticationContext);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setItems(await api.admin.listStoreItems(token));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ ...emptyItem }); };
  const startEdit = (item: StoreItem) => { setEditing(item.id); setForm({ ...item }); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    const token = getAccessToken();
    if (!token) return;
    setMessage(null);
    try {
      await api.admin.upsertStoreItem(token, {
        resource: String(form.resource || '').trim().toLowerCase(),
        cost: parseInt(form.cost, 10) || 0,
        per: parseInt(form.per, 10) || 1,
        limit: parseInt(form.limit, 10) || 1,
        enabled: Boolean(form.enabled),
      });
      setEditing(null);
      await load();
      setMessage({ type: 'success', text: 'Store item saved' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this store item?')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deleteStoreItem(token, id);
      await load();
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
          <h1 className="text-2xl font-bold">Store Items</h1>
          <p className="text-muted-foreground">Add or remove purchasable coin upgrades (for example: servers max 2).</p>
        </div>
        <Button onClick={startNew} disabled={editing !== null}>
          <PlusIcon data-icon="inline-start" /> Add Item
        </Button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Store Item' : 'Edit Store Item'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Resource Key</Label>
              <Input value={form.resource ?? ''} onChange={(e) => updateForm('resource', e.target.value)} placeholder="ram / disk / cpu / servers" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cost (coins)</Label>
              <Input type="number" value={form.cost ?? ''} onChange={(e) => updateForm('cost', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Per Purchase</Label>
              <Input type="number" value={form.per ?? ''} onChange={(e) => updateForm('per', parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Max Purchases / User</Label>
              <Input type="number" value={form.limit ?? ''} onChange={(e) => updateForm('limit', parseInt(e.target.value) || 1)} />
            </div>
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
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 justify-end">
              <Button variant="outline" onClick={cancel}><XIcon data-icon="inline-start" /> Cancel</Button>
              <Button onClick={save}><CheckIcon data-icon="inline-start" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {items.length === 0 && editing === null && (
          <p className="text-muted-foreground text-center py-8">No store items configured yet.</p>
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.resource}</p>
                  {!item.enabled && <Badge variant="outline">Disabled</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cost: {item.cost} · Per: {item.per} · Limit: {item.limit}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(item)} disabled={editing !== null}>
                  <PencilIcon className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(item.id)}>
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
