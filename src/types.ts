/**
 * VeroAI Chat SDK Types
 */

// ============================================================================
// Configuration
// ============================================================================

export interface ChatClientConfig {
  /** VeroAI API URL (e.g., https://api.veroai.dev) */
  apiUrl: string;
  /** WebSocket URL for real-time events (e.g., wss://ws.veroai.dev) */
  wsUrl?: string;
  /** Authentication token (JWT) - used for both API and WebSocket if separate tokens not provided */
  token?: string;
  /** Token getter function for dynamic token retrieval - used for both API and WebSocket if separate getters not provided */
  getToken?: () => string | null | Promise<string | null>;
  /**
   * Token getter specifically for API calls
   * Use this when your API server and WebSocket server use different auth tokens
   * (e.g., API uses accessToken from your auth server, WebSocket uses chatToken from VeroAI)
   */
  getApiToken?: () => string | null | Promise<string | null>;
  /**
   * Token getter specifically for WebSocket connections
   * Use this when your API server and WebSocket server use different auth tokens
   * Falls back to getToken if not provided
   */
  getWsToken?: () => string | null | Promise<string | null>;
  /** API key for server-side token generation (use with generateToken) */
  apiKey?: string;
  /** Auto-connect to WebSocket on initialization */
  autoConnect?: boolean;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Token Generation (Server-side)
// ============================================================================

/**
 * Options for generating a chat token
 * Used by client backends to generate tokens for their users
 */
export interface GenerateTokenOptions {
  /** User ID from client's system */
  userId: string;
  /** Display name for the user */
  name: string;
  /** Avatar URL */
  avatar?: string;
  /** Custom metadata to include in token */
  metadata?: Record<string, unknown>;
  /** Token expiration in seconds (default: 3600, max: 30 days) */
  expiresIn?: number;
}

/**
 * Result of token generation
 */
export interface GenerateTokenResult {
  /** JWT token for chat operations */
  token: string;
  /** Unix timestamp when token expires */
  expiresAt: number;
}

/**
 * User context extracted from chat token
 */
export interface ChatUser {
  /** User ID from client's system */
  id: string;
  /** Display name */
  name: string;
  /** Avatar URL */
  avatar?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isVirtual?: boolean;
  agentConfigId?: string;
  status?: PresenceStatus;
  statusMessage?: string;
  lastSeen?: string;
  createdAt?: string;
}

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  statusMessage?: string;
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Conversation Types
// ============================================================================

export type ConversationType = 'direct' | 'group' | 'channel' | 'support';

export interface Conversation {
  id: string;
  name?: string;
  type: ConversationType;
  isActive: boolean;
  lastMessageAt?: string;
  agentEnabled?: boolean;
  agentConfigId?: string;
  participants?: Participant[];
  unreadCount?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Participant {
  userId: string;
  role: 'admin' | 'member';
  isActive: boolean;
  joinedAt?: string;
  lastSeen?: string;
  user?: User;
}

export interface CreateConversationParams {
  type?: ConversationType;
  name?: string;
  participantIds: string[];
  agentConfigId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType = 'text' | 'system' | 'agent' | 'file' | 'call';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  messageType: MessageType;
  senderId?: string;
  /** Denormalized sender display name (from token at write time) */
  senderName?: string;
  /** Denormalized sender avatar URL (from token at write time) */
  senderAvatar?: string;
  /** @deprecated Use senderName/senderAvatar instead. Full sender object (requires lookup) */
  sender?: User;
  readBy?: ReadReceipt[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  editedAt?: string;
}

export interface ReadReceipt {
  userId: string;
  readAt?: string;
}

export interface SendMessageParams {
  content: string;
  messageType?: MessageType;
  metadata?: Record<string, unknown>;
}

export interface GetMessagesParams {
  limit?: number;
  offset?: number;
  before?: string;
}

export interface PaginatedMessages {
  messages: Message[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  model?: string;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'message:new'
  | 'message:updated'
  | 'message:deleted'
  | 'conversation:created'
  | 'conversation:updated'
  | 'participant:joined'
  | 'participant:left'
  | 'presence:updated'
  | 'typing:start'
  | 'typing:stop'
  | 'read:receipt'
  | 'call:ring'
  | 'call:accept'
  | 'call:reject'
  | 'call:end'
  | 'stream:start'
  | 'stream:chunk'
  | 'stream:end'
  | 'stream:error';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

export interface NewMessageEvent {
  message: Message;
  conversationId: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  userName?: string;
}

export interface PresenceEvent {
  userId: string;
  status: PresenceStatus;
  statusMessage?: string;
}

export interface ReadReceiptEvent {
  conversationId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// ============================================================================
// Call Types
// ============================================================================

export type CallAction = 'ring' | 'accept' | 'reject' | 'end';
export type CallType = 'audio' | 'video';

export interface CallEvent {
  conversationId: string;
  userId: string;
  action: CallAction;
  callType?: CallType;
  roomName?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Event Emitter Types
// ============================================================================

export interface ChatEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  error: (error: Error) => void;
  'message:new': (event: NewMessageEvent) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string, conversationId: string) => void;
  'conversation:created': (conversation: Conversation) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'participant:joined': (conversationId: string, participant: Participant) => void;
  'participant:left': (conversationId: string, userId: string) => void;
  'presence:updated': (event: PresenceEvent) => void;
  'typing:start': (event: TypingEvent) => void;
  'typing:stop': (event: TypingEvent) => void;
  'read:receipt': (event: ReadReceiptEvent) => void;
  'call:ring': (event: CallEvent) => void;
  'call:accept': (event: CallEvent) => void;
  'call:reject': (event: CallEvent) => void;
  'call:end': (event: CallEvent) => void;
  // Streaming events
  'stream:start': (event: StreamStartEvent) => void;
  'stream:chunk': (event: StreamChunkEvent) => void;
  'stream:end': (event: StreamEndEvent) => void;
  'stream:error': (event: StreamErrorEvent) => void;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Request to start an agent streaming session
 */
export interface AgentStreamRequest {
  /** Request type identifier */
  type: 'agent:stream';
  /** Unique execution identifier */
  executionId: string;
  /** Conversation ID */
  conversationId: string;
  /** User message to process */
  message: string;
  /** Optional agent config ID (uses default if not specified) */
  agentConfigId?: string;
}

/**
 * Request to cancel an active stream
 */
export interface AgentStreamCancelRequest {
  /** Request type identifier */
  type: 'agent:stream:cancel';
  /** Execution ID to cancel */
  executionId: string;
}

/**
 * Streaming message types sent from server
 */
export type StreamMessageType =
  | 'stream:start'
  | 'stream:chunk'
  | 'stream:end'
  | 'stream:error';

/**
 * Stream start event
 */
export interface StreamStartEvent {
  executionId: string;
  conversationId: string;
}

/**
 * Stream chunk event - contains a piece of the response
 */
export interface StreamChunkEvent {
  executionId: string;
  conversationId: string;
  /** The new chunk of text */
  chunk: string;
  /** Full accumulated response so far */
  accumulated: string;
}

/**
 * Stream end event - streaming completed
 */
export interface StreamEndEvent {
  executionId: string;
  conversationId: string;
  /** Final accumulated response */
  accumulated: string;
  /** Optional metadata about the response */
  metadata?: StreamMetadata;
}

/**
 * Stream error event
 */
export interface StreamErrorEvent {
  executionId: string;
  conversationId: string;
  /** Error message */
  error: string;
}

/**
 * Metadata about a streaming response
 */
export interface StreamMetadata {
  /** Total tokens used */
  tokensUsed?: number;
  /** Model used */
  model?: string;
  /** Latency in milliseconds */
  latencyMs?: number;
}

/**
 * Streaming state for a conversation
 */
export interface StreamingState {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current execution ID if streaming */
  executionId?: string;
  /** Accumulated response text */
  accumulated: string;
  /** Error if any */
  error?: string;
}
