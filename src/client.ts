/**
 * VeroAI Chat Client
 *
 * Main entry point for the Chat SDK - combines HTTP API and WebSocket
 */

import EventEmitter from 'eventemitter3';
import { ChatApi, type RoomInfo } from './api';
import { WebSocketManager } from './websocket';
import type {
  ChatClientConfig,
  ChatEvents,
  Conversation,
  CreateConversationParams,
  Message,
  SendMessageParams,
  GetMessagesParams,
  PaginatedMessages,
  User,
  PresenceStatus,
  AgentConfig,
  GenerateTokenOptions,
  GenerateTokenResult,
} from './types';

/**
 * VeroAI Chat Client
 *
 * Provides a unified interface for chat functionality:
 * - HTTP API for CRUD operations
 * - WebSocket for real-time events
 *
 * @example
 * ```typescript
 * const chat = new ChatClient({
 *   apiUrl: 'https://api.veroai.dev',
 *   wsUrl: 'wss://ws.veroai.dev',
 *   token: 'your-jwt-token',
 * });
 *
 * // Connect to real-time events
 * await chat.connect();
 *
 * // Listen for new messages
 * chat.on('message:new', ({ message, conversationId }) => {
 *   console.log('New message:', message);
 * });
 *
 * // Send a message
 * await chat.sendMessage(conversationId, { content: 'Hello!' });
 * ```
 */
export class ChatClient extends EventEmitter<ChatEvents> {
  private api: ChatApi;
  private ws: WebSocketManager | null = null;
  private config: ChatClientConfig;
  private tokenGetter: () => string | null | Promise<string | null>;

  constructor(config: ChatClientConfig) {
    super();
    this.config = config;

    // Create token getter
    this.tokenGetter = config.getToken || (() => config.token || null);

    // Initialize API client
    this.api = new ChatApi({
      apiUrl: config.apiUrl,
      getToken: this.tokenGetter,
      apiKey: config.apiKey,
    });

    // Initialize WebSocket if URL provided
    if (config.wsUrl) {
      this.ws = new WebSocketManager({
        url: config.wsUrl,
        getToken: this.tokenGetter,
        autoReconnect: config.autoReconnect ?? true,
        reconnectInterval: config.reconnectInterval,
        maxReconnectAttempts: config.maxReconnectAttempts,
      });

      // Forward WebSocket events
      this.forwardWebSocketEvents();
    }

    // Auto-connect if enabled
    if (config.autoConnect && config.wsUrl) {
      this.connect().catch((error) => {
        console.error('[ChatClient] Auto-connect failed:', error);
      });
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to WebSocket for real-time updates
   */
  async connect(): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket URL not configured');
    }
    await this.ws.connect();
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.ws?.disconnect();
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.isConnected() ?? false;
  }

  /**
   * Update authentication token
   */
  setToken(token: string): void {
    this.config.token = token;
  }

  // ============================================================================
  // Token Generation (Server-side only)
  // ============================================================================

  /**
   * Generate a chat token for a user (server-side only)
   *
   * This method is used by client backends to generate tokens for their users.
   * Requires an API key to be configured.
   *
   * @example
   * ```typescript
   * // On your backend
   * const chat = new ChatClient({
   *   apiUrl: 'https://chat-api.veroai.dev',
   *   apiKey: process.env.VERO_API_KEY,
   * });
   *
   * const { token, expiresAt } = await chat.generateToken({
   *   userId: user.id,
   *   name: user.displayName,
   *   avatar: user.avatarUrl,
   * });
   *
   * // Return token to your frontend
   * ```
   */
  async generateToken(options: GenerateTokenOptions): Promise<GenerateTokenResult> {
    return this.api.generateToken(options);
  }

  // ============================================================================
  // Conversations
  // ============================================================================

  /**
   * List all conversations for the current user
   */
  async listConversations(): Promise<Conversation[]> {
    return this.api.listConversations();
  }

  /**
   * Get a specific conversation
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.api.getConversation(conversationId);
  }

  /**
   * Create a new conversation
   */
  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const conversation = await this.api.createConversation(params);

    // Subscribe to real-time updates for new conversation
    if (this.ws?.isConnected()) {
      this.ws.subscribeToConversation(conversation.id);
    }

    return conversation;
  }

  /**
   * Mark conversation as read
   */
  async markConversationRead(conversationId: string): Promise<void> {
    return this.api.markConversationRead(conversationId);
  }

  /**
   * Leave a conversation
   */
  async leaveConversation(conversationId: string): Promise<void> {
    // Unsubscribe from real-time updates
    if (this.ws?.isConnected()) {
      this.ws.unsubscribeFromConversation(conversationId);
    }

    return this.api.leaveConversation(conversationId);
  }

  /**
   * Subscribe to real-time updates for a conversation
   */
  subscribeToConversation(conversationId: string): void {
    this.ws?.subscribeToConversation(conversationId);
  }

  /**
   * Unsubscribe from real-time updates for a conversation
   */
  unsubscribeFromConversation(conversationId: string): void {
    this.ws?.unsubscribeFromConversation(conversationId);
  }

  // ============================================================================
  // Messages
  // ============================================================================

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, params?: GetMessagesParams): Promise<PaginatedMessages> {
    return this.api.getMessages(conversationId, params);
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(conversationId: string, params: SendMessageParams): Promise<Message> {
    return this.api.sendMessage(conversationId, params);
  }

  /**
   * Send a text message (convenience method)
   */
  async send(conversationId: string, content: string): Promise<Message> {
    return this.sendMessage(conversationId, { content });
  }

  // ============================================================================
  // Typing Indicators
  // ============================================================================

  /**
   * Send typing start indicator
   */
  sendTypingStart(conversationId: string): void {
    this.ws?.sendTypingStart(conversationId);
  }

  /**
   * Send typing stop indicator
   */
  sendTypingStop(conversationId: string): void {
    this.ws?.sendTypingStop(conversationId);
  }

  // ============================================================================
  // Users & Presence
  // ============================================================================

  /**
   * List all users (contacts)
   */
  async listUsers(options?: { includeVirtual?: boolean }): Promise<User[]> {
    return this.api.listUsers(options);
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<User[]> {
    return this.api.getOnlineUsers();
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    return this.api.getCurrentUser();
  }

  /**
   * Get a specific user
   */
  async getUser(userId: string): Promise<User> {
    return this.api.getUser(userId);
  }

  /**
   * Update current user's presence status
   */
  async updateStatus(status: PresenceStatus, statusMessage?: string): Promise<void> {
    // Update via HTTP API
    await this.api.updateStatus(status, statusMessage);

    // Also notify via WebSocket for real-time propagation
    this.ws?.updatePresence(status, statusMessage);
  }

  // ============================================================================
  // Agents
  // ============================================================================

  /**
   * Add agent to conversation
   */
  async addAgentToConversation(
    conversationId: string,
    agentConfigId: string,
    addAsParticipant = true
  ): Promise<void> {
    return this.api.addAgentToConversation(conversationId, agentConfigId, addAsParticipant);
  }

  /**
   * Remove agent from conversation
   */
  async removeAgentFromConversation(conversationId: string): Promise<void> {
    return this.api.removeAgentFromConversation(conversationId);
  }

  /**
   * Toggle agent enabled/disabled
   */
  async toggleAgent(conversationId: string, enabled: boolean): Promise<void> {
    return this.api.toggleAgent(conversationId, enabled);
  }

  /**
   * List available agents
   */
  async listAgents(): Promise<AgentConfig[]> {
    return this.api.listAgents();
  }

  // ============================================================================
  // Voice/Video Calls
  // ============================================================================

  /**
   * Create a new voice/video room
   *
   * @example
   * ```typescript
   * const room = await chat.createRoom({ name: `call-${conversationId}` });
   * // Use room.wsUrl and room.token with voice client
   * ```
   */
  async createRoom(params: {
    name: string;
    emptyTimeout?: number;
    maxParticipants?: number;
  }): Promise<RoomInfo> {
    return this.api.createRoom(params);
  }

  /**
   * Join an existing room and get access token
   *
   * @example
   * ```typescript
   * const room = await chat.joinRoom({
   *   roomName: `call-${conversationId}`,
   *   participantName: 'John Doe',
   * });
   * // Connect to room using voice client SDK with room.wsUrl and room.token
   * ```
   */
  async joinRoom(params: {
    roomName: string;
    participantName: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
  }): Promise<RoomInfo> {
    return this.api.joinRoom(params);
  }

  /**
   * Initiate a call in a conversation
   * This notifies other participants that you're calling
   *
   * @example
   * ```typescript
   * // Start a video call
   * const room = await chat.startCall(conversationId, 'video');
   * // room contains { name, wsUrl, token } for Vero Voice
   * ```
   */
  async startCall(
    conversationId: string,
    callType: 'audio' | 'video' = 'audio'
  ): Promise<RoomInfo> {
    // Create room
    const roomName = `call-${conversationId}-${Date.now()}`;
    const room = await this.api.createRoom({ name: roomName });

    // Notify other participants via WebSocket
    this.ws?.sendCallNotification(conversationId, 'ring', callType, roomName);

    return room;
  }

  /**
   * Accept an incoming call
   *
   * @example
   * ```typescript
   * chat.on('call:ring', async ({ conversationId, roomName, callType }) => {
   *   const room = await chat.acceptCall(conversationId, roomName);
   *   // Connect to room using voice client SDK
   * });
   * ```
   */
  async acceptCall(
    conversationId: string,
    roomName: string,
    participantName: string
  ): Promise<RoomInfo> {
    const room = await this.api.joinRoom({ roomName, participantName });

    // Notify caller that we accepted
    this.ws?.sendCallNotification(conversationId, 'accept', undefined, roomName);

    return room;
  }

  /**
   * Reject an incoming call
   */
  rejectCall(conversationId: string): void {
    this.ws?.sendCallNotification(conversationId, 'reject');
  }

  /**
   * End an ongoing call
   */
  endCall(conversationId: string): void {
    this.ws?.sendCallNotification(conversationId, 'end');
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private forwardWebSocketEvents(): void {
    if (!this.ws) return;

    // Forward all events from WebSocket manager to ChatClient
    this.ws.on('connected', () => this.emit('connected'));
    this.ws.on('disconnected', (reason) => this.emit('disconnected', reason));
    this.ws.on('error', (error) => this.emit('error', error));
    this.ws.on('message:new', (event) => this.emit('message:new', event));
    this.ws.on('message:updated', (msg) => this.emit('message:updated', msg));
    this.ws.on('message:deleted', (msgId, convId) => this.emit('message:deleted', msgId, convId));
    this.ws.on('conversation:created', (conv) => this.emit('conversation:created', conv));
    this.ws.on('conversation:updated', (conv) => this.emit('conversation:updated', conv));
    this.ws.on('participant:joined', (convId, p) => this.emit('participant:joined', convId, p));
    this.ws.on('participant:left', (convId, userId) => this.emit('participant:left', convId, userId));
    this.ws.on('presence:updated', (event) => this.emit('presence:updated', event));
    this.ws.on('typing:start', (event) => this.emit('typing:start', event));
    this.ws.on('typing:stop', (event) => this.emit('typing:stop', event));
    this.ws.on('read:receipt', (event) => this.emit('read:receipt', event));
    this.ws.on('call:ring', (event) => this.emit('call:ring', event));
    this.ws.on('call:accept', (event) => this.emit('call:accept', event));
    this.ws.on('call:reject', (event) => this.emit('call:reject', event));
    this.ws.on('call:end', (event) => this.emit('call:end', event));
  }
}
