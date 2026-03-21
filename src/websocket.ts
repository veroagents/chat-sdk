/**
 * @veroai/chat — WebSocket Client
 *
 * Connects to msgsrv WebSocket, handles subscribe/unsubscribe,
 * unwraps the nested event format, and emits typed events.
 * Auto-reconnects with exponential backoff.
 */

import EventEmitter from 'eventemitter3';
import type {
  ChatEvents,
  ServerWsMessage,
  ServerEventType,
  MessageCreatedEvent,
  TaskStreamDeltaEvent,
  PresenceUpdatedEvent,
  TaskStatusUpdatedEvent,
  ConversationCreatedEvent,
  ConversationDeletedEvent,
  ReactionUpdatedEvent,
  CallStartedEvent,
  CallAnsweredEvent,
  CallEndedEvent,
} from './types';

export interface ChatSocketConfig {
  /** WebSocket URL (e.g., wss://ws.veroagents.com/ws) */
  url: string;
  /** Token getter — called on each connect/reconnect */
  getToken: () => string | null | Promise<string | null>;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Base reconnect interval in ms (default: 2000) */
  reconnectInterval?: number;
  /** Max reconnect attempts (default: 15) */
  maxReconnectAttempts?: number;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class ChatSocket extends EventEmitter<ChatEvents> {
  private config: Required<ChatSocketConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: string[] = [];

  /** Conversation IDs currently subscribed to (restored on reconnect) */
  private subscribedConversations = new Set<string>();
  /** Session IDs currently subscribed to (restored on reconnect) */
  private subscribedSessions = new Set<string>();

  constructor(config: ChatSocketConfig) {
    super();
    this.config = {
      url: config.url,
      getToken: config.getToken,
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 2000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 15,
    };
  }

  /** Current connection state */
  getState(): ConnectionState {
    return this.state;
  }

  /** Whether the socket is open and ready */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /** Connect to the WebSocket server */
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.state = 'connecting';
    const token = await this.config.getToken();

    if (!token) {
      this.state = 'disconnected';
      throw new Error('No authentication token available');
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const url = new URL(this.config.url);
        url.searchParams.set('token', token);

        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.resubscribe();
          this.flushPendingMessages();
          this.emit('connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.handleClose(event.reason);
        };

        this.ws.onerror = () => {
          const error = new Error('WebSocket connection error');
          this.emit('error', error);
          if (this.state === 'connecting') {
            this.state = 'disconnected';
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };
      } catch (error) {
        this.state = 'disconnected';
        reject(error);
      }
    });
  }

  /** Gracefully disconnect */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
  }

  /** Subscribe to conversation events */
  subscribe(conversationIds: string[]): void {
    if (conversationIds.length === 0) return;
    for (const id of conversationIds) {
      this.subscribedConversations.add(id);
    }
    this.sendRaw(JSON.stringify({ action: 'subscribe', conversation_ids: conversationIds }));
  }

  /** Unsubscribe from conversation events */
  unsubscribe(conversationIds: string[]): void {
    if (conversationIds.length === 0) return;
    for (const id of conversationIds) {
      this.subscribedConversations.delete(id);
    }
    this.sendRaw(JSON.stringify({ action: 'unsubscribe', conversation_ids: conversationIds }));
  }

  /** Subscribe to a brain session for live events */
  subscribeSession(sessionId: string): void {
    this.subscribedSessions.add(sessionId);
    this.sendRaw(JSON.stringify({ action: 'subscribe_session', session_id: sessionId }));
  }

  /** Unsubscribe from a brain session */
  unsubscribeSession(sessionId: string): void {
    this.subscribedSessions.delete(sessionId);
    this.sendRaw(JSON.stringify({ action: 'unsubscribe_session', session_id: sessionId }));
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private sendRaw(data: string): void {
    if (this.isConnected()) {
      this.ws!.send(data);
    } else {
      this.pendingMessages.push(data);
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.isConnected()) {
      const msg = this.pendingMessages.shift();
      if (msg) this.ws!.send(msg);
    }
  }

  /** Re-subscribe to all tracked conversations/sessions after reconnect */
  private resubscribe(): void {
    if (this.subscribedConversations.size > 0) {
      const ids = Array.from(this.subscribedConversations);
      this.sendRaw(JSON.stringify({ action: 'subscribe', conversation_ids: ids }));
    }
    for (const sid of this.subscribedSessions) {
      this.sendRaw(JSON.stringify({ action: 'subscribe_session', session_id: sid }));
    }
  }

  private handleClose(reason?: string): void {
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.ws = null;

    if (wasConnected) {
      this.emit('disconnected', reason);
    }

    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    // Exponential backoff: base * 1.5^(attempt-1), capped at 30s
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect() failure will trigger handleClose -> scheduleReconnect
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleMessage(data: string): void {
    let msg: ServerWsMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'event':
        this.handleServerEvent(msg as any);
        break;

      case 'subscribed':
        this.emit('subscribed', (msg as any).payload as string[]);
        break;

      case 'error':
        this.emit('error', new Error(String((msg as any).payload)));
        break;

      case 'session_subscribed': {
        const p = (msg as any).payload as { session_id: string };
        this.emit('session_subscribed', p.session_id);
        break;
      }

      case 'brain_event':
        this.emit('brain_event', (msg as any).payload);
        break;
    }
  }

  /**
   * Unwrap the nested event format:
   * { type: "event", conversation_id, payload: { type: "<event_type>", payload: { ... } } }
   */
  private handleServerEvent(msg: { type: 'event'; conversation_id?: string; payload: { type: ServerEventType; payload: any } }): void {
    const eventType = msg.payload.type;
    const eventPayload = msg.payload.payload;
    const convId = msg.conversation_id;

    switch (eventType) {
      case 'message.created':
        this.emit('message.created', eventPayload as MessageCreatedEvent, convId);
        break;
      case 'task_stream_delta':
        this.emit('task_stream_delta', eventPayload as TaskStreamDeltaEvent, convId);
        break;
      case 'presence.updated':
        this.emit('presence.updated', eventPayload as PresenceUpdatedEvent, convId);
        break;
      case 'task.status_updated':
        this.emit('task.status_updated', eventPayload as TaskStatusUpdatedEvent, convId);
        break;
      case 'conversation.created':
        this.emit('conversation.created', eventPayload as ConversationCreatedEvent);
        break;
      case 'conversation.deleted':
        this.emit('conversation.deleted', eventPayload as ConversationDeletedEvent);
        break;
      case 'reaction.updated':
        this.emit('reaction.updated', eventPayload as ReactionUpdatedEvent, convId);
        break;
      case 'call.started':
        this.emit('call.started', eventPayload as CallStartedEvent, convId);
        break;
      case 'call.answered':
        this.emit('call.answered', eventPayload as CallAnsweredEvent, convId);
        break;
      case 'call.ended':
        this.emit('call.ended', eventPayload as CallEndedEvent, convId);
        break;
    }
  }
}
