'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Button } from '@workspace/ui/components/button';
import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Separator } from '@workspace/ui/components/separator';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, Loader2Icon } from 'lucide-react';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type BrandConfig } from '@/lib/api';
import { cachedFetch } from '@/lib/cache';
import { setTokens } from '@/lib/auth';
import { startAuthentication } from '@simplewebauthn/browser';
import { getApiBase } from '@/lib/env';

export default function LoginPage() {
  const { login } = use(AuthenticationContext);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<BrandConfig>({});
  const [oauth, setOauth] = useState<{ discord: boolean; google: boolean; github: boolean }>({ discord: false, google: false, github: false });
  const [oauthError, setOauthError] = useState('');

  useEffect(() => {
    cachedFetch('brand', () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {});
    fetch(`${getApiBase()}/api/auth/oauth/config`)
      .then((r) => r.json())
      .then(setOauth)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setOauthError(decodeURIComponent(err));
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
    <div className="w-full flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Log in to your account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your email and password below to log in, or use a saved passkey
        </p>
      </div>

      {(error || oauthError) && (
        <Alert variant="destructive" className="w-full">
          <AlertCircleIcon className="size-4" />
          <AlertDescription>{error || oauthError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/authentication/forgot-password"
              className="text-sm font-medium underline underline-offset-4 hover:text-primary"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          disabled={loading}
        >
          {loading && <Loader2Icon className="size-4 animate-spin" />}
          Log in
        </Button>
      </form>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handlePasskey}
        disabled={loading}
      >
        <KeyRoundIcon className="size-4" />
        Use a passkey
      </Button>

      {(oauth.discord || oauth.google || oauth.github) && (
        <>
          <div className="relative flex w-full items-center justify-center">
            <Separator className="flex-1" />
            <span className="px-3 text-xs text-muted-foreground">or continue with</span>
            <Separator className="flex-1" />
          </div>
          <div className="w-full flex flex-col gap-2">
            {oauth.discord && (
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={`${getApiBase()}/api/auth/oauth/discord`}>
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 13.987 13.987 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  Sign in with Discord
                </a>
              </Button>
            )}
            {oauth.google && (
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={`${getApiBase()}/api/auth/oauth/google`}>
                  <svg className="size-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Sign in with Google
                </a>
              </Button>
            )}
            {oauth.github && (
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={`${getApiBase()}/api/auth/oauth/github`}>
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  Sign in with GitHub
                </a>
              </Button>
            )}
          </div>
        </>
      )}

      <p className="text-muted-foreground text-sm text-center">
        Don&apos;t have an account?{' '}
        <Link
          href="/authentication/register"
          className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
