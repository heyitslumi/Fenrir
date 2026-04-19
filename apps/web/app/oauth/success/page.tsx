'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/auth';

function OAuthSuccessInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    const error = params.get('error');

    if (error) {
      setStatus(`Error: ${decodeURIComponent(error)}`);
      setTimeout(() => {
        window.location.replace(`/authentication/login?error=${error}`);
      }, 3000);
      return;
    }

    if (token && refresh) {
      setTokens(token, refresh);
      window.location.replace('/');
    } else {
      setStatus('OAuth failed: missing tokens.');
      setTimeout(() => {
        window.location.replace('/authentication/login?error=OAuth+failed');
      }, 3000);
    }
  }, [params]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: '#888', fontSize: 14 }}>{status}</p>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#888', fontSize: 14 }}>Loading...</p></div>}>
      <OAuthSuccessInner />
    </Suspense>
  );
}
