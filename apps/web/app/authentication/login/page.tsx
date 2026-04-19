'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Separator } from '@workspace/ui/components/separator';
import { AlertCircleIcon, FingerprintIcon, Loader2Icon } from 'lucide-react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type BrandConfig } from '@/lib/api';
import { cachedFetch } from '@/lib/cache';
import { setTokens } from '@/lib/auth';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const { login } = use(AuthenticationContext);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<BrandConfig>({});

  useEffect(() => {
    cachedFetch('brand', () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {});
  }, []);

  const panelName = brand['panel.name'] || 'Panel';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskey() {
    setError('');
    if (!window.PublicKeyCredential) {
      setError('Passkeys are not supported in this browser.');
      return;
    }
    setLoading(true);
    try {
      const options = await api.auth.passkey.authOptions();
      const { challengeId, ...optionsJSON } = options;
      const credential = await startAuthentication({ optionsJSON });
      const res = await api.auth.passkey.authVerify(challengeId, credential);
      setTokens(res.accessToken, res.refreshToken);
      router.replace('/');
      // Force reload to pick up new session
      window.location.href = '/';
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Passkey authentication failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full border-border/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">Welcome to {panelName}</CardTitle>
        <CardDescription>Sign in to continue to your dashboard</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2Icon className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <Separator className="flex-1" />
          <span className="px-3 text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handlePasskey}
        >
          <FingerprintIcon className="size-4" />
          Sign in with passkey
        </Button>

        <p className="text-muted-foreground text-sm text-center pt-2">
          Don&apos;t have an account?{' '}
          <Link
            href="/authentication/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
