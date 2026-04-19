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
  const { user } = use(AuthenticationContext);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      if (payload['openapi.key']?.endsWith('...')) {
        delete payload['openapi.key'];
      }
      if (payload['mail.pass'] === '••••••••') {
        delete payload['mail.pass'];
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
    <div className="flex flex-col gap-6">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openapi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>
                Interactive API documentation powered by Swagger / OpenAPI. View all available endpoints, schemas, and test requests directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="openapi-key">External API Key</Label>
                  <Input
                    id="openapi-key"
                    type="password"
                    placeholder="Enter a secure API key"
                    value={settings["openapi.key"] || ""}
                    onChange={(e) => handleChange("openapi.key", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used by external services to authenticate via <code className="text-xs">Authorization: Bearer &lt;key&gt;</code> on <code className="text-xs">/api/openapi/v1/*</code> endpoints.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" asChild>
                  <a href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api$/, "") + "/api/docs"} target="_blank" rel="noopener noreferrer">
                    Open Swagger UI
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api$/, "") + "/api/docs-json"} target="_blank" rel="noopener noreferrer">
                    Download openapi.json
                  </a>
                </Button>
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
