"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import AuthenticationContext from "@/app/_context/authentication";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { ThemeCustomizer } from "@/components/theme-customizer";
import { normalizePreset } from "@/lib/themes";

function TestEmailButton() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTest = async () => {
    const token = getAccessToken();
    if (!token || !email) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.settings.testEmail(token, email);
      if (res.success) {
        setResult({ type: 'success', text: 'Test email sent successfully!' });
      } else {
        setResult({ type: 'error', text: res.error || 'Failed to send test email' });
      }
    } catch (err: any) {
      setResult({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 p-4 mt-2">
      <Label className="font-medium">Send Test Email</Label>
      <p className="text-xs text-muted-foreground">
        Save your SMTP settings first, then send a test email to verify the configuration.
      </p>
      <div className="flex items-center gap-2">
        <Input
          placeholder="recipient@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleTest} disabled={sending || !email} variant="outline" size="sm">
          {sending ? "Sending..." : "Send Test"}
        </Button>
      </div>
      {result && (
        <p className={`text-xs ${result.type === 'success' ? 'text-emerald-500' : 'text-destructive'}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  use(AuthenticationContext);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const docsBaseUrl = (typeof window !== 'undefined'
    ? ((window as any).__ENV__?.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')).replace(/\/$/, '');

  const loadSettings = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const data = await api.settings.getAll(token);
      setSettings(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      // Don't send masked API key back — only send it if user entered a new one
      const payload = { ...settings };
      if (payload['panel.apiKey']?.endsWith('...')) {
        delete payload['panel.apiKey'];
      }
      if (payload['mail.pass'] === '••••••••') {
        delete payload['mail.pass'];
      }
      // Don't send masked OAuth secrets back
      for (const key of ['oauth.discord.secret', 'oauth.google.secret', 'oauth.github.secret']) {
        if (payload[key] === '••••••••') delete payload[key];
      }
      await api.settings.update(token, payload);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your panel connection and features.</p>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <Tabs defaultValue="panel">
        <TabsList>
          <TabsTrigger value="panel">Panel Connection</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="openapi">OpenAPI</TabsTrigger>
          <TabsTrigger value="afk">AFK</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="oauth">OAuth</TabsTrigger>
        </TabsList>

        <TabsContent value="panel" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Calagopus Panel API</CardTitle>
              <CardDescription>
                Connect to your Calagopus panel. The API key is used for all operations
                (create servers, manage users, query resources).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-url">Panel URL</Label>
                <Input
                  id="panel-url"
                  placeholder="https://panel.example.com"
                  value={settings["panel.url"] || ""}
                  onChange={(e) => handleChange("panel.url", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-api-key">API Key</Label>
                <Input
                  id="panel-api-key"
                  type="password"
                  placeholder="cala_..."
                  value={settings["panel.apiKey"] || ""}
                  onChange={(e) => handleChange("panel.apiKey", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Generate an API key from your Calagopus panel admin settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Branding and general settings.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-name">Panel Name</Label>
                <Input
                  id="panel-name"
                  placeholder="My Hosting"
                  value={settings["panel.name"] || ""}
                  onChange={(e) => handleChange("panel.name", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed in the sidebar. Leave empty to show only the logo.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-logo">Logo URL</Label>
                <Input
                  id="panel-logo"
                  placeholder="https://example.com/logo.png"
                  value={settings["panel.logo"] || ""}
                  onChange={(e) => handleChange("panel.logo", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL to a logo image. Leave empty to show only the panel name.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-logo-height">Logo Height (px)</Label>
                <Input
                  id="panel-logo-height"
                  type="number"
                  placeholder="28"
                  value={settings["panel.logoHeight"] || ""}
                  onChange={(e) => handleChange("panel.logoHeight", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Height of the logo in pixels. Default is 28.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="auth-background">Login Background Image URL</Label>
                <Input
                  id="auth-background"
                  placeholder="https://example.com/background.jpg"
                  value={settings["auth.background"] || ""}
                  onChange={(e) => handleChange("auth.background", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Full-page background image shown on login and register pages. Leave empty for no background.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="app-url">App (Backend) URL</Label>
                <Input
                  id="app-url"
                  placeholder="https://api.example.com"
                  value={settings["app.url"] || ""}
                  onChange={(e) => handleChange("app.url", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The public URL of this backend API. Used as the base for OAuth callback URLs.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="auth-background-blur">Background Blur Amount (px)</Label>
                <Input
                  id="auth-background-blur"
                  type="number"
                  min="0"
                  max="20"
                  placeholder="4"
                  value={settings["auth.backgroundBlur"] || ""}
                  onChange={(e) => handleChange("auth.backgroundBlur", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Blur intensity for the background image. Default is 4px. Set to 0 for no blur.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="panel-currency">Currency Name</Label>
                <Input
                  id="panel-currency"
                  placeholder="coins"
                  value={settings["panel.currency"] || ""}
                  onChange={(e) => handleChange("panel.currency", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discord-url">Discord Invite URL</Label>
                <Input
                  id="discord-url"
                  placeholder="https://discord.gg/..."
                  value={settings["discord.url"] || ""}
                  onChange={(e) => handleChange("discord.url", e.target.value)}
                />
              </div>
              <div className="my-2 border-t border-border" />
              <div className="space-y-2">
                <Label>Default theme</Label>
                <p className="text-xs text-muted-foreground">
                  This is used for everyone until they pick a personal theme in their profile.
                </p>
              </div>
              <div className="pt-1">
                <ThemeCustomizer
                  preset={normalizePreset(settings["theme.defaultPreset"])}
                  customLightPrimary={settings["theme.custom.light.primary"] || ""}
                  customDarkPrimary={settings["theme.custom.dark.primary"] || ""}
                  customLightAccent={settings["theme.custom.light.accent"] || ""}
                  customDarkAccent={settings["theme.custom.dark.accent"] || ""}
                  onPresetChange={(value) => handleChange("theme.defaultPreset", value)}
                  onCustomLightPrimaryChange={(value) => handleChange("theme.custom.light.primary", value)}
                  onCustomDarkPrimaryChange={(value) => handleChange("theme.custom.dark.primary", value)}
                  onCustomLightAccentChange={(value) => handleChange("theme.custom.light.accent", value)}
                  onCustomDarkAccentChange={(value) => handleChange("theme.custom.dark.accent", value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="economy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Economy</CardTitle>
              <CardDescription>Daily coins and economy settings.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="daily-enabled">Daily Coins</Label>
                  <select
                    id="daily-enabled"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["daily.enabled"] || "false"}
                    onChange={(e) => handleChange("daily.enabled", e.target.value)}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="daily-amount">Daily Amount</Label>
                  <Input
                    id="daily-amount"
                    type="number"
                    placeholder="50"
                    value={settings["daily.amount"] || ""}
                    onChange={(e) => handleChange("daily.amount", e.target.value)}
                  />
                </div>
              </div>
              <div className="my-1 border-t border-border" />
              <div className="flex flex-col gap-2">
                <Label htmlFor="ads-enabled">Dashboard Ads</Label>
                <select
                  id="ads-enabled"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={settings["ads.enabled"] || "false"}
                  onChange={(e) => handleChange("ads.enabled", e.target.value)}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Enables Google AdSense ad rendering on the dashboard.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="ads-client">Google Ad Client</Label>
                  <Input
                    id="ads-client"
                    placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                    value={settings["ads.client"] || ""}
                    onChange={(e) => handleChange("ads.client", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="ads-slot">Google Ad Slot</Label>
                  <Input
                    id="ads-slot"
                    placeholder="1234567890"
                    value={settings["ads.slot"] || ""}
                    onChange={(e) => handleChange("ads.slot", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openapi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenAPI / Automation</CardTitle>
              <CardDescription>Configure API key access, rate limits, and documentation links.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="openapi-enabled">OpenAPI Access</Label>
                  <select
                    id="openapi-enabled"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["openapi.enabled"] || "true"}
                    onChange={(e) => handleChange("openapi.enabled", e.target.value)}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="openapi-key">OpenAPI Key</Label>
                  <Input
                    id="openapi-key"
                    type="password"
                    placeholder="Paste or generate a strong API key"
                    value={settings["openapi.key"] || ""}
                    onChange={(e) => handleChange("openapi.key", e.target.value)}
                  />
                </div>
              </div>
              <div className="my-1 border-t border-border" />
              <p className="text-sm font-medium">Rate limits</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="openapi-rate-short-limit">Short window limit</Label>
                  <Input
                    id="openapi-rate-short-limit"
                    type="number"
                    placeholder="5"
                    value={settings["openapi.rate.short.limit"] || ""}
                    onChange={(e) => handleChange("openapi.rate.short.limit", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="openapi-rate-short-ttl">Short window TTL (seconds)</Label>
                  <Input
                    id="openapi-rate-short-ttl"
                    type="number"
                    placeholder="1"
                    value={settings["openapi.rate.short.ttl"] || ""}
                    onChange={(e) => handleChange("openapi.rate.short.ttl", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="openapi-rate-medium-limit">Medium window limit</Label>
                  <Input
                    id="openapi-rate-medium-limit"
                    type="number"
                    placeholder="100"
                    value={settings["openapi.rate.medium.limit"] || ""}
                    onChange={(e) => handleChange("openapi.rate.medium.limit", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="openapi-rate-medium-ttl">Medium window TTL (seconds)</Label>
                  <Input
                    id="openapi-rate-medium-ttl"
                    type="number"
                    placeholder="60"
                    value={settings["openapi.rate.medium.ttl"] || ""}
                    onChange={(e) => handleChange("openapi.rate.medium.ttl", e.target.value)}
                  />
                </div>
              </div>
              <div className="my-1 border-t border-border" />
              <div className="text-sm">
                <p className="font-medium">Documentation links</p>
                <p className="text-muted-foreground mt-1">
                  <a className="underline underline-offset-2" href={`${docsBaseUrl}/openapi`} target="_blank" rel="noreferrer">OpenAPI page</a>
                  {' · '}
                  <a className="underline underline-offset-2" href={`${docsBaseUrl}/openapi/json`} target="_blank" rel="noreferrer">JSON</a>
                  {' · '}
                  <a className="underline underline-offset-2" href={`${docsBaseUrl}/openapi/yml`} target="_blank" rel="noreferrer">YAML</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>
                Configure SMTP to send verification and login notification emails. All fields are required for email to work.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-enabled">Email Sending</Label>
                  <select
                    id="mail-enabled"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["mail.enabled"] || "false"}
                    onChange={(e) => handleChange("mail.enabled", e.target.value)}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-verify">Require Email Verification</Label>
                  <select
                    id="mail-verify"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["mail.verify_email"] || "false"}
                    onChange={(e) => handleChange("mail.verify_email", e.target.value)}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-login-notify">Login Notification Emails</Label>
                  <select
                    id="mail-login-notify"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["mail.login_notify"] || "true"}
                    onChange={(e) => handleChange("mail.login_notify", e.target.value)}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Sends an email when a new login/device is detected.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-host">SMTP Host</Label>
                  <Input
                    id="mail-host"
                    placeholder="smtp.example.com"
                    value={settings["mail.host"] || ""}
                    onChange={(e) => handleChange("mail.host", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 w-32">
                  <Label htmlFor="mail-port">Port</Label>
                  <Input
                    id="mail-port"
                    type="number"
                    placeholder="587"
                    value={settings["mail.port"] || ""}
                    onChange={(e) => handleChange("mail.port", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 w-32">
                  <Label htmlFor="mail-secure">TLS/SSL</Label>
                  <select
                    id="mail-secure"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={settings["mail.secure"] || "false"}
                    onChange={(e) => handleChange("mail.secure", e.target.value)}
                  >
                    <option value="true">Yes (465)</option>
                    <option value="false">No (587)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-user">SMTP Username</Label>
                  <Input
                    id="mail-user"
                    placeholder="user@example.com"
                    value={settings["mail.user"] || ""}
                    onChange={(e) => handleChange("mail.user", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="mail-pass">SMTP Password</Label>
                  <Input
                    id="mail-pass"
                    type="password"
                    placeholder="Enter SMTP password"
                    value={settings["mail.pass"] || ""}
                    onChange={(e) => handleChange("mail.pass", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mail-from">From Address</Label>
                <Input
                  id="mail-from"
                  placeholder="noreply@example.com"
                  value={settings["mail.from"] || ""}
                  onChange={(e) => handleChange("mail.from", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The sender address shown in outgoing emails.
                </p>
              </div>
              <TestEmailButton />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oauth" className="mt-4">
          <div className="flex flex-col gap-4">
            {/* Discord */}
            <Card>
              <CardHeader>
                <CardTitle>Discord OAuth</CardTitle>
                <CardDescription>
                  Allow users to sign in with Discord. Create an app at{' '}
                  <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="underline">discord.com/developers</a>.
                  Add <strong>both</strong> redirect URIs below to your Discord app.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <div className="flex flex-col gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs font-mono">
                  <span className="text-muted-foreground">Login callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/discord/callback</span>
                  <span className="text-muted-foreground mt-1">Link callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/discord/link/callback</span>
                </div>
              </CardContent>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="discord-enabled">Discord Login</Label>
                  <select id="discord-enabled" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={settings['oauth.discord.enabled'] || 'false'} onChange={(e) => handleChange('oauth.discord.enabled', e.target.value)}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="discord-client-id">Client ID</Label>
                    <Input id="discord-client-id" placeholder="1234567890" value={settings['oauth.discord.clientId'] || ''} onChange={(e) => handleChange('oauth.discord.clientId', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="discord-secret">Client Secret</Label>
                    <Input id="discord-secret" type="password" placeholder="Enter client secret" value={settings['oauth.discord.secret'] || ''} onChange={(e) => handleChange('oauth.discord.secret', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google */}
            <Card>
              <CardHeader>
                <CardTitle>Google OAuth</CardTitle>
                <CardDescription>
                  Allow users to sign in with Google. Create credentials at{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">console.cloud.google.com</a>.
                  Add <strong>both</strong> redirect URIs below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <div className="flex flex-col gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs font-mono">
                  <span className="text-muted-foreground">Login callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/google/callback</span>
                  <span className="text-muted-foreground mt-1">Link callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/google/link/callback</span>
                </div>
              </CardContent>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google-enabled">Google Login</Label>
                  <select id="google-enabled" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={settings['oauth.google.enabled'] || 'false'} onChange={(e) => handleChange('oauth.google.enabled', e.target.value)}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="google-client-id">Client ID</Label>
                    <Input id="google-client-id" placeholder="123-abc.apps.googleusercontent.com" value={settings['oauth.google.clientId'] || ''} onChange={(e) => handleChange('oauth.google.clientId', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="google-secret">Client Secret</Label>
                    <Input id="google-secret" type="password" placeholder="Enter client secret" value={settings['oauth.google.secret'] || ''} onChange={(e) => handleChange('oauth.google.secret', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GitHub */}
            <Card>
              <CardHeader>
                <CardTitle>GitHub OAuth</CardTitle>
                <CardDescription>
                  Allow users to sign in with GitHub. Create an OAuth app at{' '}
                  <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="underline">github.com/settings/developers</a>.
                  Add <strong>both</strong> callback URLs below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <div className="flex flex-col gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs font-mono">
                  <span className="text-muted-foreground">Login callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/github/callback</span>
                  <span className="text-muted-foreground mt-1">Link callback:</span>
                  <span>{(settings['app.url'] || 'https://your-backend-url')}/api/auth/oauth/github/link/callback</span>
                </div>
              </CardContent>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="github-enabled">GitHub Login</Label>
                  <select id="github-enabled" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={settings['oauth.github.enabled'] || 'false'} onChange={(e) => handleChange('oauth.github.enabled', e.target.value)}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="github-client-id">Client ID</Label>
                    <Input id="github-client-id" placeholder="Ov23li..." value={settings['oauth.github.clientId'] || ''} onChange={(e) => handleChange('oauth.github.clientId', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="github-secret">Client Secret</Label>
                    <Input id="github-secret" type="password" placeholder="Enter client secret" value={settings['oauth.github.secret'] || ''} onChange={(e) => handleChange('oauth.github.secret', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="afk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AFK Rewards</CardTitle>
              <CardDescription>
                Users earn coins by keeping the AFK page open. Configure reward rates and party boost.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="afk-coins">Coins per interval</Label>
                  <Input
                    id="afk-coins"
                    type="number"
                    placeholder="2"
                    value={settings["afk.coins_per_interval"] || ""}
                    onChange={(e) => handleChange("afk.coins_per_interval", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Base coins awarded each interval. Default: 2.</p>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="afk-interval">Interval (seconds)</Label>
                  <Input
                    id="afk-interval"
                    type="number"
                    placeholder="60"
                    value={settings["afk.interval_seconds"] || ""}
                    onChange={(e) => handleChange("afk.interval_seconds", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Seconds between rewards. Default: 60.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="afk-party-boost">Party Boost</Label>
                <select
                  id="afk-party-boost"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={settings["afk.party_boost_enabled"] || "true"}
                  onChange={(e) => handleChange("afk.party_boost_enabled", e.target.value)}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  When enabled, more users AFK at the same time increases the coin multiplier for everyone.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
