'use client';

import { use, useCallback, useEffect, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type StoreItem, type UserResourcesResponse } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import {
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  ServerIcon,
  MinusIcon,
  PlusIcon,
  CoinsIcon,
} from 'lucide-react';

const RESOURCE_META: Record<string, { label: string; icon: React.ReactNode; unit: string }> = {
  ram: { label: 'RAM', icon: <MemoryStickIcon className="size-5" />, unit: 'MB' },
  disk: { label: 'Disk', icon: <HardDriveIcon className="size-5" />, unit: 'MB' },
  cpu: { label: 'CPU', icon: <CpuIcon className="size-5" />, unit: '%' },
  servers: { label: 'Server Slots', icon: <ServerIcon className="size-5" />, unit: '' },
};

export default function StorePage() {
  const { user } = use(AuthenticationContext);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [resources, setResources] = useState<UserResourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [itemsData, resourcesData] = await Promise.all([
        api.store.items(token),
        api.store.resources(token),
      ]);
      setItems(itemsData);
      setResources(resourcesData);
      const defaultQty: Record<string, number> = {};
      for (const item of itemsData) {
        defaultQty[item.resource] = 1;
      }
      setQuantities(defaultQty);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBuy = async (resource: string) => {
    const token = getAccessToken();
    if (!token) return;
    const qty = quantities[resource] ?? 1;
    setBuying(resource);
    setMessage(null);
    try {
      const result = await api.store.buy(token, resource, qty);
      setMessage({ type: 'success', text: `Purchased ${result.amount} ${RESOURCE_META[resource]?.unit ?? ''} ${RESOURCE_META[resource]?.label ?? resource} for ${result.spent} coins` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBuying(null);
    }
  };

  const adjustQty = (resource: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [resource]: Math.max(1, (prev[resource] ?? 1) + delta),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading store...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store</h1>
          <p className="text-muted-foreground">Purchase extra resources with coins.</p>
        </div>
        {resources && (
          <Badge variant="outline" className="text-base px-4 py-2 gap-2">
            <CoinsIcon className="size-4" />
            {resources.coins.toFixed(0)} coins
          </Badge>
        )}
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <CoinsIcon className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium">Store not configured</p>
              <p className="text-sm text-muted-foreground">An admin needs to add store items.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const meta = RESOURCE_META[item.resource];
            const qty = quantities[item.resource] ?? 1;
            const totalCost = item.cost * qty;
            const totalPer = item.per * qty;
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {meta?.icon}
                    <div>
                      <CardTitle>{meta?.label ?? item.resource}</CardTitle>
                      <CardDescription>
                        {item.cost} coins per {item.per}{meta?.unit ?? ''}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => adjustQty(item.resource, -1)}
                      disabled={qty <= 1}
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <div className="text-center min-w-[80px]">
                      <p className="text-2xl font-bold">{qty}</p>
                      <p className="text-xs text-muted-foreground">
                        +{totalPer}{meta?.unit ?? ''}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => adjustQty(item.resource, 1)}
                      disabled={qty >= item.limit}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleBuy(item.resource)}
                    disabled={buying === item.resource || (resources?.coins ?? 0) < totalCost}
                  >
                    {buying === item.resource ? 'Purchasing...' : `Buy for ${totalCost} coins`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
