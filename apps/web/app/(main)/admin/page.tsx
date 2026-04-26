'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  UsersIcon,
  ShieldIcon,
  KeyIcon,
  ServerIcon,
  EggIcon,
  MapPinIcon,
  PackageIcon,
  ShoppingCartIcon,
  SettingsIcon,
  RefreshCwIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const { hasPermission } = use(AuthenticationContext);
  const [stats, setStats] = useState<Record<string, string | null>>({});

  const loadStats = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [users, roles, eggs, locations, packages, storeItems, nodes] = await Promise.allSettled([
        hasPermission('users.read') ? api.users.list(token) : Promise.reject(),
        hasPermission('roles.read') ? api.admin.listRoles(token) : Promise.reject(),
        hasPermission('eggs.read') ? api.admin.listEggs(token) : Promise.reject(),
        hasPermission('settings.read') ? api.admin.listLocations(token) : Promise.reject(),
        hasPermission('packages.read') ? api.admin.listPackages(token) : Promise.reject(),
        hasPermission('store.read') ? api.admin.listStoreItems(token) : Promise.reject(),
        hasPermission('settings.read') ? api.admin.listNodes(token) : Promise.reject(),
      ]);
      setStats({
        users: users.status === 'fulfilled' ? `${users.value.length} total` : null,
        roles: roles.status === 'fulfilled' ? `${roles.value.length} roles` : null,
        eggs: eggs.status === 'fulfilled' ? `${eggs.value.length} eggs` : null,
        locations: locations.status === 'fulfilled' ? `${locations.value.length} locations` : null,
        packages: packages.status === 'fulfilled' ? `${packages.value.length} packages` : null,
        store: storeItems.status === 'fulfilled' ? `${storeItems.value.length} items` : null,
        nodes: nodes.status === 'fulfilled' ? `${nodes.value.length} nodes` : null,
      });
    } catch {
      // ignore
    }
  }, [hasPermission]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const cards = [
    { title: 'Users', description: 'Manage user accounts and roles', icon: UsersIcon, href: '/admin/users', stat: stats.users, permission: 'users.read' },
    { title: 'Servers', description: 'View and manage all servers', icon: ServerIcon, href: '/admin/servers', stat: null, permission: 'servers.read' },
    { title: 'Roles', description: 'Create and edit roles with permissions', icon: ShieldIcon, href: '/admin/roles', stat: stats.roles, permission: 'roles.read' },
    { title: 'Eggs', description: 'Manage server templates', icon: EggIcon, href: '/admin/eggs', stat: stats.eggs, permission: 'eggs.read' },
    { title: 'Locations', description: 'Manage server locations', icon: MapPinIcon, href: '/admin/locations', stat: stats.locations, permission: 'settings.read' },
    { title: 'Packages', description: 'Manage resource packages', icon: PackageIcon, href: '/admin/packages', stat: stats.packages, permission: 'packages.read' },
    { title: 'Store Items', description: 'Manage coin store purchasables', icon: ShoppingCartIcon, href: '/admin/store', stat: stats.store, permission: 'store.read' },
    { title: 'Sync', description: 'Sync data from Pelican panel', icon: RefreshCwIcon, href: '/admin/sync', stat: null, permission: 'settings.write' },
    { title: 'Settings', description: 'Panel configuration', icon: SettingsIcon, href: '/admin/settings', stat: null, permission: 'settings.read' },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground text-sm">System management and configuration</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => {
          const allowed = hasPermission(card.permission);
          return (
            <Link
              key={card.title}
              href={allowed ? card.href : '#'}
              className={`group rounded-lg border bg-card p-5 transition-colors ${
                allowed ? 'hover:border-primary/50 hover:shadow-sm' : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={(e) => { if (!allowed) e.preventDefault(); }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-md bg-primary/10 p-2">
                  <card.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{card.title}</h2>
                  {card.stat && <span className="text-xs text-muted-foreground">{card.stat}</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
              {!allowed && (
                <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                  <KeyIcon className="size-3" />
                  Requires {card.permission}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
