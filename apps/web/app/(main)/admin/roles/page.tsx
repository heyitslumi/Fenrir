'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type AdminRole } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import {
  ShieldIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Loader2Icon,
  UsersIcon,
} from 'lucide-react';

const KNOWN_PERMISSIONS = [
  { name: 'dashboard.read', description: 'View dashboard' },
  { name: 'users.read', description: 'View users' },
  { name: 'users.write', description: 'Create and update users' },
  { name: 'users.delete', description: 'Delete users' },
  { name: 'roles.read', description: 'View roles' },
  { name: 'roles.write', description: 'Create and update roles' },
  { name: 'roles.delete', description: 'Delete roles' },
  { name: 'servers.read', description: 'View all servers' },
  { name: 'servers.write', description: 'Manage servers (suspend/unsuspend)' },
  { name: 'servers.delete', description: 'Delete servers' },
  { name: 'settings.read', description: 'View settings' },
  { name: 'settings.write', description: 'Modify settings' },
  { name: 'eggs.read', description: 'View eggs' },
  { name: 'eggs.write', description: 'Manage eggs' },
  { name: 'packages.read', description: 'View packages' },
  { name: 'packages.write', description: 'Manage packages' },
  { name: 'store.read', description: 'View store config' },
  { name: 'store.write', description: 'Manage store config' },
];

export default function AdminRolesPage() {
  const { hasPermission } = use(AuthenticationContext);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.admin.listRoles(token);
      setRoles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  function openCreate() {
    setEditingRole(null);
    setFormName('');
    setFormDesc('');
    setFormPerms([]);
    setDialogOpen(true);
  }

  function openEdit(role: AdminRole) {
    setEditingRole(role);
    setFormName(role.name);
    setFormDesc(role.description || '');
    setFormPerms(role.permissions.map((rp) => rp.permission.name));
    setDialogOpen(true);
  }

  function togglePerm(name: string) {
    setFormPerms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  }

  function selectAll() {
    setFormPerms(KNOWN_PERMISSIONS.map((p) => p.name));
  }

  function selectNone() {
    setFormPerms([]);
  }

  async function handleSave() {
    const token = getAccessToken();
    if (!token || !formName.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingRole) {
        await api.admin.updateRole(token, editingRole.id, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          permissions: formPerms,
        });
      } else {
        await api.admin.createRole(token, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          permissions: formPerms,
        });
      }
      setDialogOpen(false);
      loadRoles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this role? Users assigned to it must be moved first.')) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await api.admin.deleteRole(token, id);
      loadRoles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">Create and manage roles with granular permissions</p>
        </div>
        {hasPermission('roles.write') && (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-1" /> New Role
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const permNames = role.permissions.map((rp) => rp.permission.name);
            return (
              <Card key={role.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldIcon className="size-4 text-primary" />
                      <span className="capitalize">{role.name}</span>
                      {role.isDefault && <Badge variant="outline" className="text-[10px]">Default</Badge>}
                    </CardTitle>
                    {hasPermission('roles.write') && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <PencilIcon className="size-3.5" />
                        </Button>
                        {!role.isDefault && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(role.id)}>
                            <TrashIcon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <CardDescription>{role.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <UsersIcon className="size-3" />
                    {role._count?.users ?? 0} user(s)
                  </div>
                  <div className="space-y-1">
                    {KNOWN_PERMISSIONS.map((perm) => {
                      const has = permNames.includes(perm.name);
                      return (
                        <div key={perm.name} className="flex items-center gap-2 text-xs">
                          {has ? (
                            <CheckIcon className="size-3 text-green-500 shrink-0" />
                          ) : (
                            <XIcon className="size-3 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className={has ? '' : 'text-muted-foreground/50'}>{perm.description}</span>
                          <span className="text-muted-foreground/40 ml-auto font-mono text-[10px]">{perm.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Update role name, description and permissions' : 'Create a new role with specific permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. moderator" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Permissions</label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
                  <button onClick={selectNone} className="text-xs text-muted-foreground hover:underline">Clear</button>
                </div>
              </div>
              <div className="space-y-1 rounded-md border p-3 max-h-60 overflow-y-auto">
                {KNOWN_PERMISSIONS.map((perm) => {
                  const checked = formPerms.includes(perm.name);
                  return (
                    <label key={perm.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerm(perm.name)}
                        className="rounded border-muted-foreground/30"
                      />
                      <span>{perm.description}</span>
                      <span className="text-muted-foreground text-xs ml-auto font-mono">{perm.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2Icon className="size-4 animate-spin mr-1" />}
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
