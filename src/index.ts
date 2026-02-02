/**
 * @veroai/chat - VeroAI Chat SDK
 *
 * Real-time messaging with AI agents
 *
 * @example Vanilla JavaScript/TypeScript
 * ```typescript
 * import { ChatClient } from '@veroai/chat';
 *
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
 * chat.on('message:new', ({ message }) => {
 *   console.log('New message:', message.content);
 * });
 *
 * // Send a message
 * await chat.send(conversationId, 'Hello!');
 * ```
 *
 * @example React
 * ```tsx
 * import { ChatProvider, useChat, useConversation } from '@veroai/chat/react';
 *
 * function App() {
 *   return (
 *     <ChatProvider config={{ apiUrl: '...', wsUrl: '...', token: '...' }}>
 *       <ChatInterface />
 *     </ChatProvider>
 *   );
 * }
 *
 * function ChatInterface() {
 *   const { conversations, isConnected } = useChat();
 *   const { messages, send } = useConversation(selectedId);
 *
 *   return <div>...</div>;
 * }
 * ```
 */

// Main client
export { ChatClient } from './client';

// API client (for advanced usage)
export { ChatApi, type RoomInfo } from './api';

// WebSocket manager (for advanced usage)
export { WebSocketManager } from './websocket';

// Types
export type {
  // Configuration
  ChatClientConfig,

  // Token generation (server-side)
  GenerateTokenOptions,
  GenerateTokenResult,
  ChatUser,

  // User types
  User,
  PresenceStatus,
  UserPresence,

  // Conversation types
  ConversationType,
  Conversation,
  Participant,
  CreateConversationParams,

  // Message types
  MessageType,
  Message,
  ReadReceipt,
  SendMessageParams,
  GetMessagesParams,
  PaginatedMessages,

  // Agent types
  AgentConfig,

  // WebSocket event types
  WebSocketEventType,
  WebSocketMessage,
  NewMessageEvent,
  TypingEvent,
  PresenceEvent,
  ReadReceiptEvent,

  // Call types
  CallAction,
  CallType,
  CallEvent,

  // Streaming types
  AgentStreamRequest,
  AgentStreamCancelRequest,
  StreamMessageType,
  StreamStartEvent,
  StreamChunkEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamMetadata,
  StreamingState,

  // Event emitter types
  ChatEvents,

  // API types
  ApiError,
  ApiResponse,
} from './types';
