'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/auth';

function OAuthSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [debug, setDebug] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    const error = params.get('error');
    if (error) {
      setDebug(`OAuth error: ${error}`);
      setTimeout(() => { window.location.href = `/authentication/login?error=${encodeURIComponent(error)}`; }, 3000);
      return;
    }
    if (token && refresh) {
      setTokens(token, refresh);
      window.location.href = '/';
    } else {
      setDebug(`Missing tokens. token=${token ? 'present' : 'missing'} refresh=${refresh ? 'present' : 'missing'}. URL: ${window.location.href}`);
      setTimeout(() => { window.location.href = '/authentication/login?error=OAuth+failed'; }, 3000);
    }
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-2">
      <p className="text-muted-foreground text-sm">Signing you in...</p>
      {debug && <p className="text-destructive text-xs max-w-md text-center">{debug}</p>}
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>}>
      <OAuthSuccessInner />
    </Suspense>
  );
}
