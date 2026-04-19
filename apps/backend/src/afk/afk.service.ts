import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

interface AfkSession {
  userId: string;
  startedAt: number;
  lastReward: number;
  earned: number;
  ws: any;
  rewardTimer?: ReturnType<typeof setTimeout>;
  stateTimer?: ReturnType<typeof setTimeout>;
}

@Injectable()
export class AfkService {
  private sessions = new Map<string, AfkSession>();
  private COINS_PER_INTERVAL = 2;
  private INTERVAL_MS = 60000;
  private STATE_UPDATE_MS = 15000;

  // Party boost
  private PARTY_BOOST_ENABLED = true;
  private MIN_MULTIPLIER = 1.0;
  private MAX_MULTIPLIER = 5.0;
  private THRESHOLDS: [number, number][] = [
    [3, 1.1],
    [5, 1.25],
    [10, 1.5],
    [20, 2.0],
    [50, 3.0],
  ];
  private cachedMultiplier = 1.0;
  private cachedPresenceCount = 0;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {
    this.loadConfig();
  }

  private async loadConfig() {
    const coins = await this.settings.get('afk.coins_per_interval');
    const interval = await this.settings.get('afk.interval_seconds');
    const enabled = await this.settings.get('afk.party_boost_enabled');
    if (coins) this.COINS_PER_INTERVAL = parseFloat(coins);
    if (interval) this.INTERVAL_MS = parseInt(interval) * 1000;
    if (enabled === 'false') this.PARTY_BOOST_ENABLED = false;
  }

  hasActiveSession(userId: string): boolean {
    return this.sessions.has(userId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  private updateCache() {
    this.cachedPresenceCount = this.sessions.size;
    if (!this.PARTY_BOOST_ENABLED) {
      this.cachedMultiplier = this.MIN_MULTIPLIER;
      return;
    }
    let multiplier = this.MIN_MULTIPLIER;
    for (const [minPresence, multi] of this.THRESHOLDS) {
      if (this.cachedPresenceCount >= minPresence) {
        multiplier = multi;
      } else break;
    }
    this.cachedMultiplier = Math.min(multiplier, this.MAX_MULTIPLIER);
  }

  private getNextThreshold(): { usersNeeded: number; nextMultiplier: number; atUsers: number } | null {
    if (!this.PARTY_BOOST_ENABLED) return null;
    for (const [minPresence, multi] of this.THRESHOLDS) {
      if (this.cachedPresenceCount < minPresence) {
        return { usersNeeded: minPresence - this.cachedPresenceCount, nextMultiplier: multi, atUsers: minPresence };
      }
    }
    return null;
  }

  private isSocketOpen(ws: any): boolean {
    return ws && ws.readyState === 1; // WebSocket.OPEN = 1
  }

  createSession(userId: string, ws: any) {
    const now = Date.now();
    const session: AfkSession = {
      userId,
      startedAt: now,
      lastReward: now,
      earned: 0,
      ws,
    };
    this.sessions.set(userId, session);
    this.updateCache();
    this.scheduleNextReward(userId);
    this.startStateUpdates(userId);
    console.log(`[AFK] +1 user (${this.cachedPresenceCount} total, x${this.cachedMultiplier})`);
  }

  private async processReward(userId: string) {
    const session = this.sessions.get(userId);
    if (!session || !this.isSocketOpen(session.ws)) {
      this.cleanup(userId);
      return;
    }

    // Check ban
    const ban = await this.settings.get(`ban.${userId}`);
    if (ban) {
      console.log(`[AFK] User ${userId} banned, kicking`);
      this.cleanup(userId);
      try { session.ws.close(4003, 'Banned'); } catch {}
      return;
    }

    try {
      const rewardAmount = this.COINS_PER_INTERVAL * this.cachedMultiplier;

      await this.prisma.userResources.update({
        where: { userId },
        data: { coins: { increment: rewardAmount } },
      });

      session.earned += rewardAmount;
      session.lastReward = Date.now();

      this.sendState(userId);
      this.scheduleNextReward(userId);
    } catch (error: any) {
      console.error(`[AFK] Reward error for ${userId}:`, error.message);
      this.cleanup(userId);
      try { session.ws.close(4000, 'Reward error'); } catch {}
    }
  }

  private scheduleNextReward(userId: string) {
    const session = this.sessions.get(userId);
    if (!session || !this.isSocketOpen(session.ws)) return;

    if (session.rewardTimer) clearTimeout(session.rewardTimer);
    session.rewardTimer = setTimeout(() => this.processReward(userId), this.INTERVAL_MS);
  }

  sendState(userId: string) {
    const session = this.sessions.get(userId);
    if (!session || !this.isSocketOpen(session.ws)) return;

    const nextRewardIn = Math.max(0, this.INTERVAL_MS - (Date.now() - session.lastReward));

    try {
      session.ws.send(JSON.stringify({
        type: 'afk_state',
        baseCoinsPerInterval: this.COINS_PER_INTERVAL,
        coinsPerInterval: this.COINS_PER_INTERVAL * this.cachedMultiplier,
        intervalMs: this.INTERVAL_MS,
        nextRewardIn,
        sessionEarned: session.earned,
        sessionDuration: Date.now() - session.startedAt,
        partyBoost: {
          enabled: this.PARTY_BOOST_ENABLED,
          presenceCount: this.cachedPresenceCount,
          multiplier: this.cachedMultiplier,
          minMultiplier: this.MIN_MULTIPLIER,
          maxMultiplier: this.MAX_MULTIPLIER,
          active: this.cachedMultiplier > this.MIN_MULTIPLIER,
          thresholds: this.THRESHOLDS,
          nextThreshold: this.getNextThreshold(),
        },
        timestamp: Date.now(),
      }));
    } catch {}
  }

  private startStateUpdates(userId: string) {
    const session = this.sessions.get(userId);
    if (!session) return;

    const update = () => {
      if (!this.isSocketOpen(session.ws)) { this.cleanup(userId); return; }
      this.sendState(userId);
      session.stateTimer = setTimeout(update, this.STATE_UPDATE_MS);
    };
    update();
  }

  cleanup(userId: string) {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.rewardTimer) clearTimeout(session.rewardTimer);
    if (session.stateTimer) clearTimeout(session.stateTimer);

    this.sessions.delete(userId);
    this.updateCache();
    console.log(`[AFK] -1 user (${this.cachedPresenceCount} total)`);
  }
}
