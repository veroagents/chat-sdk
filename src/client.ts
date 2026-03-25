/**
 * @veroai/chat — ChatClient
 *
 * Main entry point combining REST API + WebSocket into a single client.
 *
 * @example
 * ```typescript
 * import { ChatClient } from '@veroai/chat';
 *
 * const client = new ChatClient({
 *   token: 'your-jwt',
 * });
 *
 * // REST API
 * const convos = await client.api.listConversations();
 * await client.api.send({ conversationId: '...', contentText: 'Hello!' });
 *
 * // WebSocket
 * await client.connect();
 * client.subscribe(['conv-1', 'conv-2']);
 * client.on('message.created', (event, convId) => { ... });
 * ```
 */

import EventEmitter from 'eventemitter3';
import { ChatApi, type ChatApiConfig } from './api';
import { ChatSocket, type ChatSocketConfig } from './websocket';
import type { ChatConfig, ChatEvents } from './types';

const DEFAULT_API_URL = 'https://api.veroagents.com';
const DEFAULT_WS_URL = 'wss://ws.veroagents.com/ws';

export class ChatClient extends EventEmitter<ChatEvents> {
  /** REST API client — access all HTTP endpoints directly */
  public readonly api: ChatApi;

  private socket: ChatSocket | null = null;
  private tokenGetter: () => string | null | Promise<string | null>;
  private config: ChatConfig;

  constructor(config: ChatConfig = {}) {
    super();
    this.config = config;

    // Build token getter: prefer getToken function, fall back to static token
    this.tokenGetter = config.getToken ?? (() => config.token ?? null);

    const apiConfig: ChatApiConfig = {
      apiUrl: config.apiUrl ?? DEFAULT_API_URL,
      getToken: this.tokenGetter,
    };
    this.api = new ChatApi(apiConfig);

    // Auto-connect if requested
    if (config.autoConnect) {
      this.connect().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
    }
  }

  /**
   * Connect to the WebSocket server.
   *
   * Automatically calls GET /v1/messaging/token to obtain a msgsrv-compatible
   * token and WebSocket URL. The REST API token (VeroAI JWT) and the WebSocket
   * token (msgsrv JWT) are different — this method handles the exchange.
   */
  async connect(): Promise<void> {
    if (this.socket?.isConnected()) return;

    // Fetch a WebSocket-specific token via the messaging endpoint.
    // This exchanges the VeroAI JWT for a msgsrv-compatible JWT.
    let wsUrl = this.config.wsUrl ?? DEFAULT_WS_URL;
    let wsToken: string | null = null;

    try {
      const messaging = await this.api.getMessagingToken();
      wsToken = messaging.token;
      if (messaging.wsUrl) wsUrl = messaging.wsUrl;
    } catch {
      // If messaging token endpoint is unavailable, fall back to using the
      // same token as REST (works when VeroAI JWT and msgsrv JWT are the same).
      wsToken = await this.tokenGetter();
    }

    if (!this.socket) {
      const socketConfig: ChatSocketConfig = {
        url: wsUrl,
        // Use the msgsrv token for WebSocket, refreshing via getMessagingToken
        getToken: async () => {
          try {
            const messaging = await this.api.getMessagingToken();
            // wsUrl is fixed at socket creation time; reconnects use the same URL
            return messaging.token;
          } catch {
            return this.tokenGetter();
          }
        },
        autoReconnect: this.config.autoReconnect ?? true,
        reconnectInterval: this.config.reconnectInterval,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
      };
      this.socket = new ChatSocket(socketConfig);
      this.forwardSocketEvents();
    }

    await this.socket.connect();
  }

  /** Disconnect from WebSocket */
  disconnect(): void {
    this.socket?.disconnect();
  }

  /** Whether the WebSocket is connected */
  isConnected(): boolean {
    return this.socket?.isConnected() ?? false;
  }

  /** Subscribe to real-time events for conversations */
  subscribe(conversationIds: string[]): void {
    this.socket?.subscribe(conversationIds);
  }

  /** Unsubscribe from conversation events */
  unsubscribe(conversationIds: string[]): void {
    this.socket?.unsubscribe(conversationIds);
  }

  /** Subscribe to a brain session for live events */
  subscribeSession(sessionId: string): void {
    this.socket?.subscribeSession(sessionId);
  }

  /** Unsubscribe from a brain session */
  unsubscribeSession(sessionId: string): void {
    this.socket?.unsubscribeSession(sessionId);
  }

  /** Update the static token (useful after auth refresh) */
  setToken(token: string): void {
    this.config.token = token;
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private forwardSocketEvents(): void {
    if (!this.socket) return;

    // Connection lifecycle
    this.socket.on('connected', () => this.emit('connected'));
    this.socket.on('disconnected', (r) => this.emit('disconnected', r));
    this.socket.on('error', (e) => this.emit('error', e));
    this.socket.on('subscribed', (ids) => this.emit('subscribed', ids));

    // Conversation events
    this.socket.on('message.created', (ev, cid) => this.emit('message.created', ev, cid));
    this.socket.on('task_stream_delta', (ev, cid) => this.emit('task_stream_delta', ev, cid));
    this.socket.on('presence.updated', (ev, cid) => this.emit('presence.updated', ev, cid));
    this.socket.on('task.status_updated', (ev, cid) => this.emit('task.status_updated', ev, cid));
    this.socket.on('conversation.created', (ev) => this.emit('conversation.created', ev));
    this.socket.on('conversation.deleted', (ev) => this.emit('conversation.deleted', ev));
    this.socket.on('reaction.updated', (ev, cid) => this.emit('reaction.updated', ev, cid));
    this.socket.on('call.started', (ev, cid) => this.emit('call.started', ev, cid));
    this.socket.on('call.answered', (ev, cid) => this.emit('call.answered', ev, cid));
    this.socket.on('call.ended', (ev, cid) => this.emit('call.ended', ev, cid));

    // Brain events
    this.socket.on('brain_event', (p) => this.emit('brain_event', p));
    this.socket.on('session_subscribed', (sid) => this.emit('session_subscribed', sid));
  }
}
