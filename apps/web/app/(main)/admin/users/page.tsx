'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type UserListItem } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import {
  ShieldIcon,
  UserIcon,
  RefreshCwIcon,
  SearchIcon,
  Loader2Icon,
  ChevronRightIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user: currentUser } = use(AuthenticationContext);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.users.list(token);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm">Manage user accounts, roles and resources</p>
        </div>
        <Button variant="outline" onClick={loadUsers} disabled={loading}>
          <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {search ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="flex flex-col hover:underline">
                        <span className="font-medium">{u.name || '—'}</span>
                        <span className="text-muted-foreground text-xs">{u.email}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="gap-1 text-xs">
                        {u.role === 'admin' ? <ShieldIcon className="size-3" /> : <UserIcon className="size-3" />}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button variant="ghost" size="sm">
                          {u.id === currentUser?.id && <span className="text-xs text-muted-foreground mr-1">You</span>}
                          <ChevronRightIcon className="size-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
