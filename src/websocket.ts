/**
 * VeroAI Chat WebSocket Manager
 *
 * Handles WebSocket connection, reconnection, and message handling
 */

import EventEmitter from 'eventemitter3';
import type {
  ChatEvents,
  WebSocketMessage,
  NewMessageEvent,
  TypingEvent,
  PresenceEvent,
  ReadReceiptEvent,
  CallEvent,
  CallAction,
  CallType,
  Message,
  Conversation,
  Participant,
} from './types';

export interface WebSocketConfig {
  url: string;
  getToken: () => string | null | Promise<string | null>;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * WebSocket connection manager with auto-reconnect
 */
export class WebSocketManager extends EventEmitter<ChatEvents> {
  private config: Required<WebSocketConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingMessages: string[] = [];

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      getToken: config.getToken,
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the WebSocket server
   */
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

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with token
        const url = new URL(this.config.url);
        url.searchParams.set('token', token);

        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushPendingMessages();
          this.emit('connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.handleClose(event.reason);
        };

        this.ws.onerror = (event) => {
          const error = new Error('WebSocket error');
          this.emit('error', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.state = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
  }

  /**
   * Send a message through the WebSocket
   */
  send(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });

    if (this.isConnected()) {
      this.ws!.send(message);
    } else {
      // Queue message for when connection is restored
      this.pendingMessages.push(message);
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingStart(conversationId: string): void {
    this.send('typing:start', { conversationId });
  }

  /**
   * Stop typing indicator
   */
  sendTypingStop(conversationId: string): void {
    this.send('typing:stop', { conversationId });
  }

  /**
   * Subscribe to conversations for real-time updates
   */
  subscribeToConversation(conversationId: string): void {
    this.subscribeToConversations([conversationId]);
  }

  /**
   * Subscribe to multiple conversations for real-time updates
   */
  subscribeToConversations(conversationIds: string[]): void {
    // Server expects { type: "subscribe", conversationIds: [...] } at top level (not in payload)
    const message = JSON.stringify({
      type: 'subscribe',
      conversationIds,
      timestamp: new Date().toISOString(),
    });

    if (this.isConnected()) {
      this.ws!.send(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  /**
   * Unsubscribe from a conversation
   */
  unsubscribeFromConversation(conversationId: string): void {
    this.unsubscribeFromConversations([conversationId]);
  }

  /**
   * Unsubscribe from multiple conversations
   */
  unsubscribeFromConversations(conversationIds: string[]): void {
    // Server expects { type: "unsubscribe", conversationIds: [...] } at top level (not in payload)
    const message = JSON.stringify({
      type: 'unsubscribe',
      conversationIds,
      timestamp: new Date().toISOString(),
    });

    if (this.isConnected()) {
      this.ws!.send(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  /**
   * Update presence status
   */
  updatePresence(status: string, statusMessage?: string): void {
    this.send('presence:update', { status, statusMessage });
  }

  /**
   * Send call notification (ring, accept, reject, end)
   * Note: Actual WebRTC signaling is handled by LiveKit
   */
  sendCallNotification(
    conversationId: string,
    action: CallAction,
    callType?: CallType,
    roomName?: string
  ): void {
    this.send('call', { conversationId, action, callType, roomName });
  }

  private handleClose(reason?: string): void {
    this.stopHeartbeat();
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.ws = null;

    if (wasConnected) {
      this.emit('disconnected', reason);
    }

    // Attempt reconnection if enabled
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        // Connect will handle scheduling next reconnect
      }
    }, delay);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage;

      switch (message.type) {
        case 'message:new':
          this.emit('message:new', message.payload as NewMessageEvent);
          break;

        case 'message:updated':
          this.emit('message:updated', message.payload as Message);
          break;

        case 'message:deleted': {
          const { messageId, conversationId } = message.payload as {
            messageId: string;
            conversationId: string;
          };
          this.emit('message:deleted', messageId, conversationId);
          break;
        }

        case 'conversation:created':
          this.emit('conversation:created', message.payload as Conversation);
          break;

        case 'conversation:updated':
          this.emit('conversation:updated', message.payload as Conversation);
          break;

        case 'participant:joined': {
          const { conversationId, participant } = message.payload as {
            conversationId: string;
            participant: Participant;
          };
          this.emit('participant:joined', conversationId, participant);
          break;
        }

        case 'participant:left': {
          const payload = message.payload as { conversationId: string; userId: string };
          this.emit('participant:left', payload.conversationId, payload.userId);
          break;
        }

        case 'presence:updated':
          this.emit('presence:updated', message.payload as PresenceEvent);
          break;

        case 'typing:start':
          this.emit('typing:start', message.payload as TypingEvent);
          break;

        case 'typing:stop':
          this.emit('typing:stop', message.payload as TypingEvent);
          break;

        case 'read:receipt':
          this.emit('read:receipt', message.payload as ReadReceiptEvent);
          break;

        case 'call:ring':
          this.emit('call:ring', message.payload as CallEvent);
          break;

        case 'call:accept':
          this.emit('call:accept', message.payload as CallEvent);
          break;

        case 'call:reject':
          this.emit('call:reject', message.payload as CallEvent);
          break;

        case 'call:end':
          this.emit('call:end', message.payload as CallEvent);
          break;
      }
    } catch (error) {
      console.error('[ChatWS] Failed to parse message:', error);
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.isConnected()) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.ws!.send(message);
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', {});
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
