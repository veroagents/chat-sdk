# @veroai/chat

Real-time messaging SDK for VeroAI applications. Provides an HTTP API client, WebSocket connection management, and typed events for building chat interfaces with AI agents.

## Features

- **Real-time messaging** - WebSocket-based with auto-reconnect and exponential backoff
- **Conversation management** - Create, update, delete conversations with participants
- **Message reactions** - Toggle emoji reactions on messages
- **Message forwarding** - Forward messages across conversations
- **Batch sync** - Sync multiple conversations in a single request
- **AI agents** - Built-in support for agent conversations and brain session events
- **Voice/video calls** - Call lifecycle events (started, answered, ended)
- **TypeScript** - Full type safety with camelCase API over snake_case server protocol

## Installation

```bash
npm install @veroai/chat
# or
pnpm add @veroai/chat
# or
yarn add @veroai/chat
```

## Quick Start

```typescript
import { ChatClient } from '@veroai/chat';

const client = new ChatClient({
  apiUrl: 'https://api.veroagents.com',
  token: 'your-jwt-token',
});

// REST API
const conversations = await client.api.listConversations();
await client.api.send({ conversationId: 'conv-1', contentText: 'Hello!' });

// Real-time events
await client.connect();
client.subscribe(['conv-1']);
client.on('message.created', (event, conversationId) => {
  console.log('New message in', conversationId, event);
});
```

## Configuration

```typescript
interface ChatConfig {
  /** VeroAI API base URL (default: https://api.veroagents.com) */
  apiUrl?: string;
  /** WebSocket URL for real-time events (default: wss://ws.veroagents.com/ws) */
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
```

## API Reference

### ChatClient

The main entry point combining REST API + WebSocket into a single client.

#### Connection Management

```typescript
// Connect to WebSocket (exchanges VeroAI JWT for a msgsrv-compatible token automatically)
await client.connect();

// Disconnect
client.disconnect();

// Check connection status
client.isConnected();

// Update auth token
client.setToken(newToken);
```

#### Subscriptions

```typescript
// Subscribe to real-time events for conversations
client.subscribe(['conv-1', 'conv-2']);

// Unsubscribe from conversation events
client.unsubscribe(['conv-1']);

// Subscribe to a brain session for live events
client.subscribeSession(sessionId);

// Unsubscribe from a brain session
client.unsubscribeSession(sessionId);
```

#### REST API (`client.api`)

All HTTP methods are accessed via `client.api`:

##### Messages

```typescript
// Send a message
const message = await client.api.send({
  conversationId: 'conv-1',
  contentText: 'Hello!',
  contentType: 'text',       // 'text' | 'image' | 'audio' | 'video' | 'file' | 'task' | 'result' | 'system'
  replyToId: 'msg-id',       // optional: reply to a message
  threadRole: 'main',        // 'main' | 'aside'
  taskId: 'task-id',         // optional: associate with a task
});

// Get messages (paginated by sequence number)
const { messages, currentSeq } = await client.api.getMessages('conv-1', {
  fromSeq: 0,
  toSeq: 100,
  limit: 50,
});

// Batch sync multiple conversations
const { batches } = await client.api.sync([
  { conversationId: 'conv-1', lastSeq: 42 },
  { conversationId: 'conv-2', lastSeq: 10 },
]);

// Toggle emoji reaction
const { action } = await client.api.toggleReaction('msg-id', 'conv-1', '👍');
// action: 'added' | 'removed'

// Forward a message to other conversations
const { forwarded } = await client.api.forward('msg-id', ['conv-2', 'conv-3']);
```

##### Conversations

```typescript
// List all conversations
const conversations = await client.api.listConversations();

// Create a conversation
const newConv = await client.api.createConversation({
  type: 'direct',  // 'direct' | 'group' | 'agent_direct' | 'agent_group'
  participantIds: ['user-1', 'user-2'],
  name: 'Optional name',
});

// Update a conversation
await client.api.updateConversation('conv-1', {
  name: 'New Name',
  description: 'Updated description',
});

// Mark conversation as read up to a sequence number
await client.api.markRead('conv-1', 42);

// Delete a conversation
await client.api.deleteConversation('conv-1', 'for_me'); // 'for_me' | 'for_everyone'

// Manage participants
await client.api.addParticipants('conv-1', ['user-3', 'user-4']);
await client.api.removeParticipant('conv-1', 'user-3');
const participants = await client.api.getParticipants('conv-1');
```

##### Users & Agents

```typescript
// List users
const users = await client.api.listUsers();

// List agents
const agents = await client.api.listAgents();
```

##### Messaging Token

```typescript
// Get a WebSocket auth token (used internally by connect())
const { token, wsUrl, expiresAt } = await client.api.getMessagingToken();
```

### Events

```typescript
// Connection events
client.on('connected', () => { /* WebSocket connected */ });
client.on('disconnected', (reason?) => { /* WebSocket disconnected */ });
client.on('error', (error) => { /* Error occurred */ });
client.on('subscribed', (conversationIds) => { /* Subscription confirmed */ });

// Message events
client.on('message.created', (event, conversationId?) => {
  // event: { message_id, seq_num, is_internal? }
});

// Task/agent streaming
client.on('task_stream_delta', (event, conversationId?) => {
  // event: { delta, agent_id, session_id }
});

// Presence
client.on('presence.updated', (event, conversationId?) => {
  // event: { agent_id?, user_id?, status, status_detail? }
});

// Task status
client.on('task.status_updated', (event, conversationId?) => {
  // event: { task_id, status, current_step?, progress_narrative?, agent_id? }
});

// Conversation lifecycle
client.on('conversation.created', (event) => {
  // event: { conversation_id, contact_name?, contact_id?, group_name? }
});
client.on('conversation.deleted', (event) => {
  // event: { conversation_id }
});

// Reactions
client.on('reaction.updated', (event, conversationId?) => {
  // event: { message_id, emoji, action: 'added' | 'removed', user_id }
});

// Call events
client.on('call.started', (event, conversationId?) => {
  // event: { call_id, room_name, call_type, conversation_id, initiator_id }
});
client.on('call.answered', (event, conversationId?) => {
  // event: { call_id, conversation_id, answered_by }
});
client.on('call.ended', (event, conversationId?) => {
  // event: { call_id, conversation_id, duration_seconds }
});

// Brain session events
client.on('brain_event', (payload) => { /* opaque payload */ });
client.on('session_subscribed', (sessionId) => { /* session subscription confirmed */ });
```

## Types

```typescript
// Conversation types
type ConversationType = 'direct' | 'group' | 'agent_direct' | 'agent_group';
type ContentType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'task' | 'result' | 'system';
type SenderType = 'human' | 'agent';
type ThreadRole = 'main' | 'aside';
type ParticipantRole = 'owner' | 'admin' | 'member' | 'agent';
type DeleteMode = 'for_me' | 'for_everyone';

interface Message {
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

interface Conversation {
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

interface User {
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

interface Participant {
  userId: string;
  displayName: string;
  isAgent: boolean;
  role: ParticipantRole;
  avatarUrl?: string;
  status?: string;
  jobTitle?: string;
}
```

## Advanced Usage

### Custom Token Refresh

```typescript
const client = new ChatClient({
  getToken: async () => {
    const token = localStorage.getItem('token');
    if (isExpired(token)) {
      const newToken = await refreshToken();
      localStorage.setItem('token', newToken);
      return newToken;
    }
    return token;
  },
});
```

### Direct API Access

For server-side usage or when you don't need WebSocket:

```typescript
import { ChatApi } from '@veroai/chat';

const api = new ChatApi({
  apiUrl: 'https://api.veroagents.com',
  getToken: () => localStorage.getItem('token'),
});

const conversations = await api.listConversations();
```

### Direct WebSocket Access

For custom WebSocket handling:

```typescript
import { ChatSocket } from '@veroai/chat';

const socket = new ChatSocket({
  url: 'wss://ws.veroagents.com/ws',
  getToken: () => localStorage.getItem('token'),
  autoReconnect: true,
  reconnectInterval: 2000,
  maxReconnectAttempts: 15,
});

await socket.connect();
socket.subscribe(['conv-1', 'conv-2']);
socket.on('message.created', (event, conversationId) => { ... });
```

## License

MIT
