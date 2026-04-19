'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { api, type BrandConfig } from '@/lib/api';
import { cachedFetch } from '@/lib/cache';

export default function AuthenticationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [brand, setBrand] = useState<BrandConfig>({});

  useEffect(() => {
    cachedFetch('brand', () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {});
  }, []);

  const logo = brand['panel.logo'];
  const name = brand['panel.name'] || 'Panel';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={40}
            height={40}
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            {name.charAt(0)}
          </div>
        )}
      </div>

      <div className="w-full max-w-md">{children}</div>

      <div className="mt-12 flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {name}. All rights reserved.</p>
      </div>
    </div>
  );
}
