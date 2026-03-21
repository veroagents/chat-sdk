/**
 * @veroai/chat SDK Types
 *
 * Types aligned with msgsrv's actual API protocol.
 */

// ============================================================================
// Configuration
// ============================================================================

export interface ChatConfig {
  /** VeroAI API base URL. Default: https://api.veroagents.com */
  apiUrl?: string;
  /** WebSocket URL for real-time events. Default: wss://ws.veroagents.com/ws */
  wsUrl?: string;
  /** Static JWT token for authentication */
  token?: string;
  /** Async token getter (takes precedence over static token) */
  getToken?: () => string | null | Promise<string | null>;
  /** Auto-connect WebSocket on client creation */
  autoConnect?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Base reconnect interval in ms (default: 2000) */
  reconnectInterval?: number;
  /** Max reconnect attempts (default: 15) */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Domain Types (camelCase — what the SDK exposes)
// ============================================================================

export type ConversationType = 'direct' | 'group' | 'agent_direct' | 'agent_group';
export type ContentType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'task' | 'result' | 'system';
export type SenderType = 'human' | 'agent';
export type ThreadRole = 'main' | 'aside';
export type ParticipantRole = 'owner' | 'admin' | 'member' | 'agent';
export type DeleteMode = 'for_me' | 'for_everyone';

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  seqNum: number;
  senderId: string;
  senderType: SenderType;
  contentType: ContentType;
  contentText: string;
  contentMeta?: string;
  replyToId?: string;
  threadId?: string;
  threadRole: ThreadRole;
  taskId?: string;
  createdAt: string;
  isInternal?: boolean;
  isForwarded?: boolean;
  reactions?: ReactionGroup[];
}

export interface ConversationContact {
  userId: string;
  displayName: string;
  isAgent: boolean;
  status: string;
  avatarUrl?: string;
  bio?: string;
  lastSeen?: string;
  jobRole?: string;
  isDefaultAgent?: boolean;
  language?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  description?: string;
  createdBy: string;
  lastActivity?: string;
  seqCounter: number;
  createdAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
  contact?: ConversationContact;
}

export interface Participant {
  userId: string;
  displayName: string;
  isAgent: boolean;
  role: ParticipantRole;
  avatarUrl?: string;
  status?: string;
  jobTitle?: string;
}

export interface User {
  id: string;
  displayName: string;
  isAgent: boolean;
  status: string;
  bio?: string;
  avatarUrl?: string;
  lastSeen?: string;
  jobTitle?: string;
  language?: string;
  isDefaultAgent?: boolean;
}

export type Agent = User;

// ============================================================================
// Request Params
// ============================================================================

export interface SendMessageParams {
  conversationId: string;
  contentText: string;
  contentType?: ContentType;
  contentMeta?: string;
  replyToId?: string;
  threadRole?: ThreadRole;
  taskId?: string;
}

export interface GetMessagesParams {
  fromSeq?: number;
  toSeq?: number;
  limit?: number;
}

export interface GetMessagesResponse {
  messages: Message[];
  currentSeq: number;
}

export interface SyncConversation {
  conversationId: string;
  lastSeq: number;
}

export interface SyncBatch {
  conversationId: string;
  messages: Message[];
  currentSeq: number;
}

export interface SyncResponse {
  batches: SyncBatch[];
}

export interface CreateConversationParams {
  type?: ConversationType;
  name?: string;
  participantIds?: string[];
}

export interface CreateConversationResponse {
  id: string;
  type: ConversationType;
  name?: string;
  createdBy: string;
}

export interface UpdateConversationParams {
  name?: string;
  description?: string;
}

export interface ToggleReactionResponse {
  action: 'added' | 'removed';
}

export interface ForwardResponse {
  forwarded: Message[];
}

export interface MessagingTokenResponse {
  token: string;
  wsUrl: string;
  expiresAt: string;
}

// ============================================================================
// WebSocket Protocol Types
// ============================================================================

/** Client-to-server actions */
export type ClientAction = 'subscribe' | 'unsubscribe' | 'subscribe_session' | 'unsubscribe_session';

export interface ClientSubscribeMessage {
  action: 'subscribe';
  conversation_ids: string[];
}

export interface ClientUnsubscribeMessage {
  action: 'unsubscribe';
  conversation_ids: string[];
}

export interface ClientSubscribeSessionMessage {
  action: 'subscribe_session';
  session_id: string;
}

export interface ClientUnsubscribeSessionMessage {
  action: 'unsubscribe_session';
  session_id: string;
}

export type ClientWsMessage =
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage
  | ClientSubscribeSessionMessage
  | ClientUnsubscribeSessionMessage;

/** Server-to-client wrapper */
export interface ServerEventMessage {
  type: 'event';
  conversation_id?: string;
  payload: {
    type: ServerEventType;
    payload: unknown;
  };
}

export interface ServerSubscribedMessage {
  type: 'subscribed';
  payload: string[];
}

export interface ServerErrorMessage {
  type: 'error';
  payload: string;
}

export interface ServerSessionSubscribedMessage {
  type: 'session_subscribed';
  payload: { session_id: string };
}

export interface ServerBrainEventMessage {
  type: 'brain_event';
  payload: unknown;
}

export type ServerWsMessage =
  | ServerEventMessage
  | ServerSubscribedMessage
  | ServerErrorMessage
  | ServerSessionSubscribedMessage
  | ServerBrainEventMessage;

// ============================================================================
// Server Event Types (inside the nested payload)
// ============================================================================

export type ServerEventType =
  | 'message.created'
  | 'task_stream_delta'
  | 'presence.updated'
  | 'task.status_updated'
  | 'conversation.created'
  | 'conversation.deleted'
  | 'reaction.updated'
  | 'call.started'
  | 'call.answered'
  | 'call.ended';

export interface MessageCreatedEvent {
  message_id: string;
  seq_num: number;
  is_internal?: boolean;
}

export interface TaskStreamDeltaEvent {
  delta: string;
  agent_id: string;
  session_id: string;
}

export interface PresenceUpdatedEvent {
  agent_id?: string;
  user_id?: string;
  status: string;
  status_detail?: string;
}

export interface TaskStatusUpdatedEvent {
  task_id: string;
  status: string;
  current_step?: string;
  progress_narrative?: string;
  agent_id?: string;
}

export interface ConversationCreatedEvent {
  conversation_id: string;
  contact_name?: string;
  contact_id?: string;
  group_name?: string;
}

export interface ConversationDeletedEvent {
  conversation_id: string;
}

export interface ReactionUpdatedEvent {
  message_id: string;
  emoji: string;
  action: 'added' | 'removed';
  user_id: string;
}

export interface CallStartedEvent {
  call_id: string;
  room_name: string;
  call_type: string;
  conversation_id: string;
  initiator_id: string;
}

export interface CallAnsweredEvent {
  call_id: string;
  conversation_id: string;
  answered_by: string;
}

export interface CallEndedEvent {
  call_id: string;
  conversation_id: string;
  duration_seconds: number;
}

// ============================================================================
// SDK Event Map (typed event emitter signatures)
// ============================================================================

export interface ChatEvents {
  /** WebSocket connected */
  connected: () => void;
  /** WebSocket disconnected */
  disconnected: (reason?: string) => void;
  /** Connection or protocol error */
  error: (error: Error) => void;
  /** Server confirmed subscription */
  subscribed: (conversationIds: string[]) => void;

  // Conversation events (from server)
  'message.created': (event: MessageCreatedEvent, conversationId?: string) => void;
  'task_stream_delta': (event: TaskStreamDeltaEvent, conversationId?: string) => void;
  'presence.updated': (event: PresenceUpdatedEvent, conversationId?: string) => void;
  'task.status_updated': (event: TaskStatusUpdatedEvent, conversationId?: string) => void;
  'conversation.created': (event: ConversationCreatedEvent) => void;
  'conversation.deleted': (event: ConversationDeletedEvent) => void;
  'reaction.updated': (event: ReactionUpdatedEvent, conversationId?: string) => void;
  'call.started': (event: CallStartedEvent, conversationId?: string) => void;
  'call.answered': (event: CallAnsweredEvent, conversationId?: string) => void;
  'call.ended': (event: CallEndedEvent, conversationId?: string) => void;

  /** Brain session event (opaque payload) */
  brain_event: (payload: unknown) => void;
  /** Session subscription confirmed */
  session_subscribed: (sessionId: string) => void;
}

// ============================================================================
// API Error
// ============================================================================

export class ChatApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}
