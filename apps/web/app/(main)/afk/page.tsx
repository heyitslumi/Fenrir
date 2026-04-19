'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Badge } from '@workspace/ui/components/badge';
import {
  CoinsIcon,
  UsersIcon,
  TimerIcon,
  ZapIcon,
  WifiIcon,
  WifiOffIcon,
  TrendingUpIcon,
  ClockIcon,
  SparklesIcon,
  ChevronDownIcon,
} from 'lucide-react';

interface AfkState {
  type: string;
  baseCoinsPerInterval: number;
  coinsPerInterval: number;
  intervalMs: number;
  nextRewardIn: number;
  sessionEarned: number;
  sessionDuration: number;
  partyBoost: {
    enabled: boolean;
    presenceCount: number;
    multiplier: number;
    minMultiplier: number;
    maxMultiplier: number;
    active: boolean;
    thresholds: [number, number][];
    nextThreshold: { usersNeeded: number; nextMultiplier: number; atUsers: number } | null;
  };
  timestamp: number;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  return `${remainingMinutes}m ${remainingSeconds}s`;
}

export default function AfkPage() {
  const [state, setState] = useState<AfkState | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStart] = useState(() => Date.now());
  const [sessionEarned, setSessionEarned] = useState(0);
  const [showThresholds, setShowThresholds] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const lastStateRef = useRef<AfkState | null>(null);
  const lastReceivedAt = useRef(0);
  const [tick, setTick] = useState(0);
  const connectingRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (connectingRef.current) return;

    connectingRef.current = true;
    setConnecting(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError('Not authenticated');
      setConnecting(false);
      connectingRef.current = false;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '').replace(/\/api$/, '') || 'localhost:3001';
    const ws = new WebSocket(`${protocol}//${backendHost}/api/afk/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      connectingRef.current = false;
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onclose = (event) => {
      setConnected(false);
      setConnecting(false);
      connectingRef.current = false;
      wsRef.current = null;

      if (event.code === 4002) {
        // Old connection was replaced by a new one — don't show error or retry
        return;
      } else if (event.code === 4001) {
        setError('Session expired. Please refresh.');
      } else if (event.code === 4003) {
        setError('Your account is banned');
      } else if (reconnectAttempts.current < 5) {
        reconnectAttempts.current++;
        reconnectRef.current = setTimeout(connect, 15000);
      } else {
        setError('Connection failed. Please refresh the page.');
      }
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AfkState;
        if (data.type === 'afk_state') {
          // Detect reward grant
          const last = lastStateRef.current;
          if (last && data.nextRewardIn > last.nextRewardIn + 5000) {
            setSessionEarned((prev) => prev + data.coinsPerInterval);
          }
          lastStateRef.current = data;
          lastReceivedAt.current = Date.now();
          setState(data);
        }
      } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      connectingRef.current = false;
    };
  }, [connect]);

  // Reconnect on visibility change
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && !wsRef.current && !connectingRef.current) connect();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [connect]);

  // Client-side 1s tick for smooth countdown without server spam
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  const pb = state?.partyBoost;
  const elapsed = Date.now() - lastReceivedAt.current;
  const interpolatedNextReward = state ? Math.max(0, state.nextRewardIn - elapsed) : 0;
  const countdown = Math.ceil(interpolatedNextReward / 1000);
  const progress = state ? ((state.intervalMs - interpolatedNextReward) / state.intervalMs) * 100 : 0;
  void tick; // used to trigger re-render

  // Threshold progress
  let thresholdProgress = 0;
  if (pb?.nextThreshold && pb?.thresholds && pb.thresholds.length > 0) {
    const currentIdx = pb.thresholds.findIndex((t: [number, number]) => t[0] > pb!.presenceCount) - 1;
    const prevThreshold = currentIdx >= 0 ? pb.thresholds[currentIdx]![0] : 0;
    const nextThreshold = pb.nextThreshold.atUsers;
    thresholdProgress = ((pb.presenceCount - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">AFK Rewards</h1>
        <p className="text-sm text-muted-foreground">Earn coins by keeping this page open</p>
      </div>

      {/* Connection Status */}
      <Card className={connected ? 'border-primary/30' : error ? 'border-destructive/30' : ''}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connected ? (
                <WifiIcon className="size-5 text-primary" />
              ) : (
                <WifiOffIcon className="size-5 text-muted-foreground" />
              )}
              <span className="font-medium">Connection Status</span>
            </div>
            <Badge variant={connected ? 'default' : error ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
              {connected ? 'Connected' : connecting ? 'Connecting...' : error ? 'Disconnected' : 'Idle'}
            </Badge>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Party Boost */}
        <Card className={pb?.active ? 'border-primary/30 relative overflow-hidden' : ''}>
          {pb?.active && (
            <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
          )}
          <CardHeader className="relative z-10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <UsersIcon className="size-5" />
                Party Boost
              </CardTitle>
              <Badge variant={pb?.active ? 'default' : 'secondary'} className="text-lg font-bold px-4 py-1.5">
                x{(pb?.multiplier ?? 1).toFixed(2)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            {/* Active Users */}
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(pb?.presenceCount ?? 1, 5) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary/20"
                    >
                      <UsersIcon className="size-3.5 text-primary" />
                    </div>
                  ))}
                  {(pb?.presenceCount ?? 0) > 5 && (
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-bold">
                      +{(pb?.presenceCount ?? 0) - 5}
                    </div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">Active users</span>
              </div>
              <span className="text-xl font-bold">{pb?.presenceCount ?? 0}</span>
            </div>

            {/* Status */}
            <p className="text-sm text-muted-foreground">
              {pb?.active ? (
                <span className="text-primary font-medium">
                  <SparklesIcon className="inline size-4 mr-1" />
                  Party Boost active! (+{(((pb?.multiplier ?? 1) - 1) * 100).toFixed(0)}% bonus)
                </span>
              ) : pb?.enabled ? (
                'Invite more friends to boost earnings!'
              ) : (
                'Party boost is disabled'
              )}
            </p>

            {/* Next Threshold */}
            {pb?.nextThreshold && (
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next threshold</span>
                  <span className="text-primary font-medium">
                    +{pb.nextThreshold.usersNeeded} users → x{pb.nextThreshold.nextMultiplier}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, thresholdProgress))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Thresholds Toggle */}
            {pb?.thresholds && pb.thresholds.length > 0 && (
              <div>
                <button
                  onClick={() => setShowThresholds(!showThresholds)}
                  className="flex w-full items-center justify-between rounded-xl p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>View all thresholds</span>
                  <ChevronDownIcon className={`size-4 transition-transform ${showThresholds ? 'rotate-180' : ''}`} />
                </button>
                {showThresholds && (
                  <div className="mt-2 space-y-2">
                    {pb.thresholds.map(([users, mult]) => (
                      <div
                        key={users}
                        className={`flex items-center justify-between rounded-lg p-3 text-sm ${
                          pb.presenceCount >= users
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <span>{users}+ users</span>
                        <span className="font-medium">x{mult}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Rewards */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <CoinsIcon className="size-5" />
                Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Earning Rate */}
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <ZapIcon className="size-5 text-primary" />
                  <div>
                    <span className="text-sm text-muted-foreground">Earning rate</span>
                    {pb?.active && (
                      <div className="text-xs text-muted-foreground">
                        Base: {state?.baseCoinsPerInterval ?? 0}/min
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">
                    {(state?.coinsPerInterval ?? 0).toFixed(2)} coins/min
                  </span>
                  {pb?.active && (
                    <div className="text-xs text-primary font-medium">Boosted!</div>
                  )}
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <TimerIcon className="size-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Next reward</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-1000"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-lg font-medium">{countdown}s</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <TrendingUpIcon className="size-5" />
                Session Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <ClockIcon className="size-4" /> Time active
                  </div>
                  <div className="text-xl font-medium">
                    {formatTime(state?.sessionDuration ?? (Date.now() - sessionStart))}
                  </div>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <CoinsIcon className="size-4" /> Earned
                  </div>
                  <div className="text-xl font-medium text-emerald-500">
                    +{(state?.sessionEarned ?? sessionEarned).toFixed(2)} coins
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
