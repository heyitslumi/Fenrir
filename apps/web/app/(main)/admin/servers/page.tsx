'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import {
  RefreshCwIcon,
  SearchIcon,
  Loader2Icon,
  ChevronRightIcon,
} from 'lucide-react';
import Link from 'next/link';

interface PelicanServer {
  uuid: string;
  name: string;
  status: string | null;
  is_suspended: boolean;
  limits: { memory: number; disk: number; cpu: number };
  node?: { name: string } | null;
  user?: { username: string; email: string } | null;
}

export default function AdminServersPage() {
  const [servers, setServers] = useState<PelicanServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadServers = useCallback(async (p = 1) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.admin.listAllServers(token, p);
      const data = res?.servers?.data ?? res?.data ?? [];
      setServers(data.map((s: any) => ({
        uuid: s.uuid,
        name: s.name,
        status: s.status,
        is_suspended: s.is_suspended ?? false,
        limits: s.limits ?? { memory: 0, disk: 0, cpu: 0 },
        node: s.node,
        user: s.user,
      })));
      const meta = res?.servers?.meta ?? res?.meta;
      if (meta?.pagination) {
        setTotalPages(meta.pagination.total_pages ?? 1);
      }
      setPage(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServers(1); }, [loadServers]);

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.uuid.toLowerCase().includes(search.toLowerCase()) ||
      s.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
      s.user?.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All Servers</h1>
          <p className="text-muted-foreground text-sm">Manage all servers across the panel</p>
        </div>
        <Button variant="outline" onClick={() => loadServers(page)} disabled={loading}>
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
        <Input placeholder="Search servers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Server</th>
                  <th className="px-4 py-3 text-left font-medium">Owner</th>
                  <th className="px-4 py-3 text-left font-medium">Node</th>
                  <th className="px-4 py-3 text-left font-medium">Resources</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {search ? 'No servers match your search' : 'No servers found'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.uuid} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/servers/${s.uuid}`} className="flex flex-col hover:underline">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground text-xs font-mono">{s.uuid.slice(0, 8)}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.user?.username || s.user?.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {(s.node as any)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{s.limits.memory}MB</span>
                          <span>{s.limits.disk}MB</span>
                          <span>{s.limits.cpu}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.is_suspended ? (
                          <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/servers/${s.uuid}`}>
                          <Button variant="ghost" size="sm">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadServers(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadServers(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
