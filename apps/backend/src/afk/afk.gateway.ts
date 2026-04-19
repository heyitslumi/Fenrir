import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server } from 'ws';
import { AfkService } from './afk.service.js';
import { AuthService } from '../auth/auth.service.js';

@WebSocketGateway({ path: '/api/afk/ws' })
export class AfkGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Map ws instance -> userId for cleanup on disconnect
  private wsUserMap = new Map<any, string>();

  constructor(
    private afkService: AfkService,
    private authService: AuthService,
  ) {}

  async handleConnection(client: any, ...args: any[]) {
    try {
      // Extract token from query string or headers
      const req = args[0];
      let token: string | null = null;

      if (req?.url) {
        const url = new URL(req.url, 'http://localhost');
        token = url.searchParams.get('token');
      }
      if (!token && req?.headers?.authorization) {
        token = req.headers.authorization.replace('Bearer ', '');
      }

      if (!token) {
        client.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        client.close(4001, 'Unauthorized');
        return;
      }

      const user = await this.authService.validateToken(token);
      if (!user) {
        client.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        client.close(4001, 'Invalid token');
        return;
      }

      const userId = user.id;

      // If user already has a session, close the old one and replace it
      if (this.afkService.hasActiveSession(userId)) {
        // Find and close the old websocket
        for (const [oldClient, oldUserId] of this.wsUserMap.entries()) {
          if (oldUserId === userId) {
            this.wsUserMap.delete(oldClient);
            try { oldClient.close(4002, 'Replaced by new connection'); } catch {}
            break;
          }
        }
        this.afkService.cleanup(userId);
      }

      // Register session
      this.wsUserMap.set(client, userId);
      this.afkService.createSession(userId, client);

      // Listen directly on the raw WS close event — handleDisconnect is unreliable with platform-ws
      client.on('close', () => {
        const uid = this.wsUserMap.get(client);
        if (uid) {
          this.afkService.cleanup(uid);
          this.wsUserMap.delete(client);
          console.log(`[AFK Gateway] Client disconnected: ${uid}`);
        }
      });

      client.send(JSON.stringify({ type: 'connected', userId }));
    } catch (error: any) {
      console.error('[AFK Gateway] Connection error:', error.message);
      try { client.close(4000, 'Connection error'); } catch {}
    }
  }

  handleDisconnect(client: any) {
    // Fallback — primary cleanup happens in the 'close' event listener above
    const userId = this.wsUserMap.get(client);
    if (userId) {
      this.afkService.cleanup(userId);
      this.wsUserMap.delete(client);
    }
  }
}
