'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api } from '@/lib/api';
import { getApiBase } from '@/lib/env';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import { Separator } from '@workspace/ui/components/separator';
import {
  CameraIcon,
  SaveIcon,
  ShieldIcon,
  MailIcon,
  KeyIcon,
  FingerprintIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  SmartphoneIcon,
  MonitorIcon,
  LogOutIcon,
  ServerIcon,
  PackageIcon,
  UserIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  GlobeIcon,
  XIcon,
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface PasskeyItem {
  id: string;
  credentialId: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
}

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('curl')) return 'curl';
  return ua.slice(0, 40);
}

export default function ProfilePage() {
  const { user, logout } = use(AuthenticationContext);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Passkeys
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeyName, setPasskeyName] = useState('');
  const [registering, setRegistering] = useState(false);

  // Panel account
  const [panelAccount, setPanelAccount] = useState<{ linked: boolean; calagopusId: string | null; username: string | null; email: string | null } | null>(null);
  const [panelPassword, setPanelPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // OAuth linked accounts
  const [linkedAccounts, setLinkedAccounts] = useState<{ provider: string; providerUid: string; username: string | null; createdAt: string }[]>([]);
  const [oauthConfig, setOauthConfig] = useState<{ discord: boolean; google: boolean; github: boolean }>({ discord: false, google: false, github: false });
  const [oauthMsg, setOauthMsg] = useState('');

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const loadPasskeys = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.auth.passkey.list(token);
      setPasskeys(data);
    } catch { /* ignore */ }
    setPasskeysLoading(false);
  }, []);

  const loadPanelAccount = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.users.panelAccount(token);
      setPanelAccount(data);
    } catch { /* ignore */ }
  }, []);

  const loadSessions = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.auth.sessions.list(token);
      setSessions(data);
    } catch { /* ignore */ }
    setSessionsLoading(false);
  }, []);

  const loadLinkedAccounts = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const config = await fetch(`${getApiBase()}/api/auth/oauth/config`).then((r) => r.json());
      setOauthConfig(config);
    } catch { /* ignore */ }
    try {
      const linked = await api.auth.oauth.linked(token);
      setLinkedAccounts(linked);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('linked');
    const linkError = params.get('link_error');
    if (linked) setOauthMsg(`${linked.charAt(0).toUpperCase() + linked.slice(1)} linked successfully`);
    if (linkError) setOauthMsg(`Error: ${linkError}`);
    if (linked || linkError) window.history.replaceState({}, '', '/profile');
  }, []);

  useEffect(() => {
    loadPasskeys();
    loadPanelAccount();
    loadSessions();
    loadLinkedAccounts();
  }, [loadPasskeys, loadPanelAccount, loadSessions, loadLinkedAccounts]);

  const handleSaveProfile = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.users.updateProfile(token, { name: name.trim() || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const token = getAccessToken();
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      const preview = URL.createObjectURL(file);
      setAvatarPreview(preview);
      await api.users.uploadAvatar(token, file);
    } catch (err: any) {
      setError(err.message);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    const token = getAccessToken();
    if (!token) return;
    setRegistering(true);
    setError('');
    try {
      const options = await api.auth.passkey.registerOptions(token);
      const credential = await startRegistration({ optionsJSON: options });
      await api.auth.passkey.registerVerify(token, credential, passkeyName || undefined);
      setPasskeyName('');
      loadPasskeys();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Failed to register passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    if (!confirm('Delete this passkey? You won\'t be able to use it to sign in anymore.')) return;
    try {
      await api.auth.passkey.delete(token, id);
      loadPasskeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const apiBase = typeof window !== 'undefined' ? ((window as any).__ENV__?.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
  const rawAvatar = avatarPreview || user?.avatar;
  const avatarSrc = rawAvatar && !rawAvatar.startsWith('blob:') && !rawAvatar.startsWith('http') ? `${apiBase}${rawAvatar}` : rawAvatar;
  const initials = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings and security</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {saved && <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-500">Profile saved successfully.</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your display name and avatar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group shrink-0"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="size-16 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border-2 border-border">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <CameraIcon className="size-5 text-white" />
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Profile Picture</p>
                  <p className="text-xs text-muted-foreground">Click to change. Max 2MB.</p>
                  {uploading && <p className="text-xs text-primary mt-1">Uploading...</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                <SaveIcon className="size-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <MailIcon className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <ShieldIcon className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <Badge variant="outline" className="mt-0.5">{user?.role || 'user'}</Badge>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <KeyIcon className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Account ID</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{user?.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Panel Account */}
          {panelAccount?.linked && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ServerIcon className="size-5" /> Panel Account
                </CardTitle>
                <CardDescription>Your linked game panel account credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {panelAccount.username && (
                  <div className="flex items-center gap-3">
                    <UserIcon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Username</p>
                      <p className="text-sm text-muted-foreground font-mono truncate">{panelAccount.username}</p>
                    </div>
                  </div>
                )}
                {panelAccount.calagopusId && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <KeyIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Panel Account ID</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{panelAccount.calagopusId}</p>
                      </div>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Password</p>
                  {panelPassword ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono">
                        {showPassword ? panelPassword : '••••••••••••••••'}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(panelPassword); }}>
                        <CopyIcon className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-2">Reset to generate a new password you can use to log in to the game panel directly.</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={resettingPassword}
                    onClick={async () => {
                      const token = getAccessToken();
                      if (!token) return;
                      setResettingPassword(true);
                      setError('');
                      try {
                        const res = await api.users.resetPanelPassword(token);
                        setPanelPassword(res.password);
                        setShowPassword(true);
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setResettingPassword(false);
                      }
                    }}
                  >
                    {resettingPassword ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <RotateCcwIcon className="size-4 mr-1" />}
                    Reset Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Passkeys */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FingerprintIcon className="size-5" /> Passkeys
                  </CardTitle>
                  <CardDescription>Use biometrics or security keys to sign in without a password</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Register new */}
              <div className="flex gap-2">
                <Input
                  placeholder="Passkey name (optional)"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleRegisterPasskey} disabled={registering} size="sm">
                  {registering ? <Loader2Icon className="size-4 animate-spin mr-1" /> : <PlusIcon className="size-4 mr-1" />}
                  Add
                </Button>
              </div>

              {/* List */}
              {passkeysLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : passkeys.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <FingerprintIcon className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No passkeys registered yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add one to enable passwordless sign-in</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {passkeys.map((pk) => (
                    <div key={pk.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {pk.deviceType === 'multiDevice' ? (
                          <SmartphoneIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <MonitorIcon className="size-4 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{pk.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {pk.credentialId ? `${pk.credentialId.slice(0, 16)}...` : pk.id.slice(0, 8)} · Added {new Date(pk.createdAt).toLocaleDateString()}
                            {pk.backedUp && <span className="ml-2 text-emerald-500">Synced</span>}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePasskey(pk.id)} className="text-destructive hover:text-destructive">
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlobeIcon className="size-5" /> Connected Accounts
              </CardTitle>
              <CardDescription>Link your social accounts for quick sign-in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {oauthMsg && (
                <div className={`text-sm rounded-md p-2 ${oauthMsg.startsWith('Error') ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {oauthMsg}
                </div>
              )}
              {!oauthConfig.discord && !oauthConfig.google && !oauthConfig.github ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">No OAuth providers configured</p>
                  <p className="text-xs text-muted-foreground mt-1">OAuth can be enabled by an administrator in panel settings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(['discord', 'google', 'github'] as const).filter((p) => oauthConfig[p]).map((provider) => {
                    const linked = linkedAccounts.find((a) => a.provider === provider);
                    const icons: Record<string, React.ReactNode> = {
                      discord: <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 13.987 13.987 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>,
                      google: <svg className="size-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
                      github: <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>,
                    };
                    const label = provider.charAt(0).toUpperCase() + provider.slice(1);
                    return (
                      <div key={provider} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{icons[provider]}</span>
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            {linked ? (
                              <p className="text-xs text-emerald-500">
                                {linked.username && <span className="font-medium">{linked.username}</span>}
                                {linked.username && linked.providerUid && <span className="text-emerald-500/70"> · </span>}
                                {linked.providerUid && <span className="text-emerald-500/70">ID: {linked.providerUid}</span>}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Not connected</p>
                            )}
                          </div>
                        </div>
                        {linked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              const token = getAccessToken();
                              if (!token) return;
                              try {
                                await api.auth.oauth.unlink(token, provider);
                                setOauthMsg(`${label} unlinked`);
                                loadLinkedAccounts();
                              } catch (err: any) {
                                setOauthMsg(`Error: ${err.message}`);
                              }
                            }}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={`${getApiBase()}/api/auth/oauth/${provider}/link?state=${user?.id}`}>
                              Connect
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlobeIcon className="size-5" /> Active Sessions
              </CardTitle>
              <CardDescription>Devices currently logged in to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions</p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <MonitorIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {parseUA(s.userAgent)}
                          {s.current && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Current</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.ipAddress || 'Unknown IP'} · {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!s.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={async () => {
                          const token = getAccessToken();
                          if (!token) return;
                          try {
                            await api.auth.sessions.delete(token, s.id);
                            loadSessions();
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
              <div className="pt-2">
                <Button variant="destructive" size="sm" onClick={logout}>
                  <LogOutIcon className="size-4 mr-1" /> Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
