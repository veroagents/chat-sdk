/**
 * @veroai/chat — Real-time messaging with AI agents
 *
 * @example
 * ```typescript
 * import { ChatClient } from '@veroai/chat';
 *
 * const client = new ChatClient({
 *   apiUrl: 'https://api.veroagents.com',
 *   wsUrl: 'wss://ws.veroagents.com/ws',
 *   token: 'your-jwt-token',
 * });
 *
 * // REST API
 * const conversations = await client.api.listConversations();
 * await client.api.send({ conversationId: 'conv-1', contentText: 'Hello!' });
 *
 * // Real-time events
 * await client.connect();
 * client.subscribe(['conv-1']);
 * client.on('message.created', (event, conversationId) => {
 *   console.log('New message in', conversationId, event);
 * });
 * ```
 */

// Main client
export { ChatClient } from './client';

// API client (for standalone usage)
export { ChatApi } from './api';

// WebSocket client (for standalone usage)
export { ChatSocket } from './websocket';

// All types
export {
  ChatApiError,
  type ChatConfig,
  type ConversationType,
  type ContentType,
  type SenderType,
  type ThreadRole,
  type ParticipantRole,
  type DeleteMode,
  type ReactionGroup,
  type Message,
  type ConversationContact,
  type Conversation,
  type Participant,
  type User,
  type Agent,
  type SendMessageParams,
  type GetMessagesParams,
  type GetMessagesResponse,
  type SyncConversation,
  type SyncBatch,
  type SyncResponse,
  type CreateConversationParams,
  type CreateConversationResponse,
  type UpdateConversationParams,
  type ToggleReactionResponse,
  type ForwardResponse,
  type MessagingTokenResponse,
  type ClientAction,
  type ClientWsMessage,
  type ServerWsMessage,
  type ServerEventType,
  type MessageCreatedEvent,
  type TaskStreamDeltaEvent,
  type PresenceUpdatedEvent,
  type TaskStatusUpdatedEvent,
  type ConversationCreatedEvent,
  type ConversationDeletedEvent,
  type ReactionUpdatedEvent,
  type CallStartedEvent,
  type CallAnsweredEvent,
  type CallEndedEvent,
  type ChatEvents,
} from './types';
