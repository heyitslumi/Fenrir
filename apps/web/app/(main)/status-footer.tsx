'use client';

import { useEffect, useState } from 'react';
import { getLastCacheTime } from '@/lib/cache';

const VERSION = 'v0.0.1';

export function StatusFooter() {
  const [cacheTime, setCacheTime] = useState<string>('—');

  useEffect(() => {
    const update = () => {
      const ts = getLastCacheTime();
      if (!ts) {
        setCacheTime('—');
        return;
      }
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 5) setCacheTime('just now');
      else if (diff < 60) setCacheTime(`${diff}s ago`);
      else setCacheTime(`${Math.floor(diff / 60)}m ago`);
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="shrink-0 border-t px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground/50 select-none">
      <span>{VERSION}</span>
      <span>cache: {cacheTime}</span>
    </footer>
  );
}
