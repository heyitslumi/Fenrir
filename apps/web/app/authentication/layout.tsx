'use client';

import { useEffect, useState } from 'react';
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

  const name = brand['panel.name'] || 'Panel';
  const bg = brand['auth.background'];
  const blurAmount = brand['auth.backgroundBlur'] ?? '4';

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-4 overflow-hidden bg-background">
      {bg && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${bg})`,
              filter: `blur(${blurAmount}px)`,
              transform: 'scale(1.05)',
            }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>

      <div className="relative z-10 mt-10 flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {name}. All rights reserved.</p>
      </div>
    </div>
  );
}
