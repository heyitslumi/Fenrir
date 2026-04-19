'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AuthenticationContext from '@/app/_context/authentication';
import { api } from '@/lib/api';
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

  useEffect(() => {
    loadPasskeys();
    loadPanelAccount();
    loadSessions();
  }, [loadPasskeys, loadPanelAccount, loadSessions]);

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

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
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

          {/* SSO */}
          <Card>
            <CardHeader>
              <CardTitle>Single Sign-On</CardTitle>
              <CardDescription>Connect external identity providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">No SSO providers configured</p>
                <p className="text-xs text-muted-foreground mt-1">SSO can be enabled by an administrator in panel settings</p>
              </div>
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
