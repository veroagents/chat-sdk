# @veroai/chat

Real-time messaging SDK for VeroAI applications. Provides HTTP API client, WebSocket connection management, and React integration for building chat interfaces with AI agents.

## Features

- **Real-time messaging** - WebSocket-based with auto-reconnect
- **Typing indicators** - Show when users are typing
- **Presence tracking** - Online/away/busy/offline status
- **Read receipts** - Track message read status
- **Voice/video calls** - Vero Voice integration for WebRTC calls
- **AI agents** - Built-in support for AI agent conversations
- **React hooks** - Ready-to-use hooks for React applications
- **TypeScript** - Full type safety

## Installation

```bash
npm install @veroai/chat
# or
pnpm add @veroai/chat
# or
yarn add @veroai/chat
```

## Quick Start

### Vanilla TypeScript/JavaScript

```typescript
import { ChatClient } from '@veroai/chat';

const chat = new ChatClient({
  apiUrl: 'https://api.veroai.dev',
  wsUrl: 'wss://ws.veroai.dev',
  token: 'your-jwt-token',
});

// Connect to real-time events
await chat.connect();

// Listen for new messages
chat.on('message:new', ({ message, conversationId }) => {
  console.log('New message:', message.content);
});

// Send a message
await chat.send(conversationId, 'Hello!');
```

### React

```tsx
import { ChatProvider, useChat, useConversation } from '@veroai/chat/react';

function App() {
  return (
    <ChatProvider
      config={{
        apiUrl: 'https://api.veroai.dev',
        wsUrl: 'wss://ws.veroai.dev',
        token: authToken,
      }}
    >
      <ChatApp />
    </ChatProvider>
  );
}

function ChatApp() {
  const { conversations, isConnected } = useChat();

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {conversations.map(conv => (
        <ConversationItem key={conv.id} conversation={conv} />
      ))}
    </div>
  );
}

function ChatRoom({ conversationId }) {
  const { messages, send, typingUsers, startTyping, stopTyping } = useConversation(conversationId);
  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map(m => <Message key={m.id} message={m} />)}
      {typingUsers.length > 0 && <p>Someone is typing...</p>}
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          startTyping();
        }}
        onBlur={stopTyping}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            send(input);
            setInput('');
          }
        }}
      />
    </div>
  );
}
```

## Configuration

```typescript
interface ChatClientConfig {
  /** VeroAI API URL */
  apiUrl: string;
  /** WebSocket URL for real-time events */
  wsUrl?: string;
  /** JWT authentication token */
  token?: string;
  /** Dynamic token getter (for token refresh) */
  getToken?: () => string | null | Promise<string | null>;
  /** Auto-connect to WebSocket on initialization */
  autoConnect?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect interval in ms (default: 3000) */
  reconnectInterval?: number;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
}
```

## API Reference

### ChatClient

#### Connection Management

```typescript
// Connect to WebSocket
await chat.connect();

// Disconnect
chat.disconnect();

// Check connection status
chat.isConnected();

// Update auth token
chat.setToken(newToken);
```

#### Conversations

```typescript
// List all conversations
const conversations = await chat.listConversations();

// Get a specific conversation
const conversation = await chat.getConversation(conversationId);

// Create a new conversation
const newConv = await chat.createConversation({
  type: 'direct', // 'direct' | 'group' | 'channel'
  participantIds: ['user-id-1', 'user-id-2'],
  name: 'Optional name for groups',
});

// Mark conversation as read
await chat.markConversationRead(conversationId);

// Leave a conversation
await chat.leaveConversation(conversationId);

// Subscribe to real-time updates
chat.subscribeToConversation(conversationId);
chat.unsubscribeFromConversation(conversationId);
```

#### Messages

```typescript
// Get messages (paginated)
const { messages, hasMore, total } = await chat.getMessages(conversationId, {
  limit: 50,
  before: 'message-id', // For pagination
});

// Send a message
const message = await chat.sendMessage(conversationId, {
  content: 'Hello!',
  messageType: 'text', // 'text' | 'system' | 'agent' | 'file'
  metadata: { custom: 'data' },
});

// Convenience method
await chat.send(conversationId, 'Hello!');
```

#### Typing Indicators

```typescript
// Send typing indicator
chat.sendTypingStart(conversationId);
chat.sendTypingStop(conversationId);
```

#### Users & Presence

```typescript
// List users (contacts)
const users = await chat.listUsers({ includeVirtual: true });

// Get online users
const onlineUsers = await chat.getOnlineUsers();

// Get current user profile
const me = await chat.getCurrentUser();

// Get specific user
const user = await chat.getUser(userId);

// Update presence status
await chat.updateStatus('online', 'Working on something cool');
// Status: 'online' | 'away' | 'busy' | 'offline'
```

#### AI Agents

```typescript
// List available agents
const agents = await chat.listAgents();

// Add agent to conversation
await chat.addAgentToConversation(conversationId, agentConfigId);

// Remove agent from conversation
await chat.removeAgentFromConversation(conversationId);

// Toggle agent enabled/disabled
await chat.toggleAgent(conversationId, true);
```

#### Voice/Video Calls

The SDK integrates with Vero Voice for WebRTC voice and video calls. Call signaling (ring, accept, reject, end) is handled via WebSocket, while actual media streams go through Vero Voice.

```typescript
// Create a room
const room = await chat.createRoom({
  name: 'call-room-123',
  emptyTimeout: 300, // seconds
  maxParticipants: 10,
});
// Returns: { name, wsUrl, token }

// Join an existing room
const room = await chat.joinRoom({
  roomName: 'call-room-123',
  participantName: 'John Doe',
  canPublish: true,
  canSubscribe: true,
});

// Start a call (creates room + notifies participants)
const room = await chat.startCall(conversationId, 'video'); // 'audio' | 'video'

// Accept an incoming call
chat.on('call:ring', async ({ conversationId, roomName, callType }) => {
  const room = await chat.acceptCall(conversationId, roomName, 'My Name');
  // Connect to Vero Voice using room.wsUrl and room.token
});

// Reject a call
chat.rejectCall(conversationId);

// End a call
chat.endCall(conversationId);
```

### Events

```typescript
// Connection events
chat.on('connected', () => { /* WebSocket connected */ });
chat.on('disconnected', (reason) => { /* WebSocket disconnected */ });
chat.on('error', (error) => { /* Error occurred */ });

// Message events
chat.on('message:new', ({ message, conversationId }) => { });
chat.on('message:updated', (message) => { });
chat.on('message:deleted', (messageId, conversationId) => { });

// Conversation events
chat.on('conversation:created', (conversation) => { });
chat.on('conversation:updated', (conversation) => { });
chat.on('participant:joined', (conversationId, participant) => { });
chat.on('participant:left', (conversationId, userId) => { });

// Presence events
chat.on('presence:updated', ({ userId, status, statusMessage }) => { });

// Typing events
chat.on('typing:start', ({ conversationId, userId, userName }) => { });
chat.on('typing:stop', ({ conversationId, userId }) => { });

// Read receipt events
chat.on('read:receipt', ({ conversationId, messageId, userId, readAt }) => { });

// Call events
chat.on('call:ring', ({ conversationId, userId, callType, roomName }) => { });
chat.on('call:accept', ({ conversationId, userId, roomName }) => { });
chat.on('call:reject', ({ conversationId, userId }) => { });
chat.on('call:end', ({ conversationId, userId }) => { });
```

## React Hooks

### ChatProvider

Wrap your app with `ChatProvider` to enable chat functionality:

```tsx
import { ChatProvider } from '@veroai/chat/react';

<ChatProvider
  config={{
    apiUrl: 'https://api.veroai.dev',
    wsUrl: 'wss://ws.veroai.dev',
    token: authToken,
  }}
  autoFetchConversations={true}
  autoFetchCurrentUser={true}
>
  {children}
</ChatProvider>
```

### useChat

Access chat context and global state:

```tsx
import { useChat } from '@veroai/chat/react';

function MyComponent() {
  const {
    client,              // ChatClient instance
    isConnected,         // WebSocket connection status
    currentUser,         // Current user profile
    conversations,       // List of conversations
    isLoadingConversations,
    refreshConversations,
    connect,
    disconnect,
    updateStatus,
  } = useChat();
}
```

### useChatClient

Get direct access to the ChatClient:

```tsx
import { useChatClient } from '@veroai/chat/react';

function MyComponent() {
  const client = useChatClient();
  // Use client directly for advanced operations
}
```

### useConversation

Manage a single conversation with real-time updates:

```tsx
import { useConversation } from '@veroai/chat/react';

function ChatRoom({ conversationId }) {
  const {
    conversation,    // Conversation object
    messages,        // Messages array
    isLoading,       // Loading state
    hasMore,         // More messages available
    typingUsers,     // Users currently typing
    sendMessage,     // Send message with params
    send,            // Send text message (convenience)
    loadMore,        // Load older messages
    refresh,         // Refresh messages
    markAsRead,      // Mark conversation as read
    startTyping,     // Send typing indicator
    stopTyping,      // Stop typing indicator
    error,           // Error if any
  } = useConversation(conversationId, {
    autoFetchMessages: true,
    initialMessageLimit: 50,
    autoSubscribe: true,
  });
}
```

### usePresence

Track online users and presence status:

```tsx
import { usePresence } from '@veroai/chat/react';

function OnlineUsers() {
  const {
    onlineUsers,     // Array of online users
    isLoading,
    getUserStatus,   // Get status for specific user
    refresh,
    error,
  } = usePresence();

  return (
    <ul>
      {onlineUsers.map(user => (
        <li key={user.id}>
          {user.firstName} - {getUserStatus(user.id)}
        </li>
      ))}
    </ul>
  );
}
```

### useUserPresence

Track presence for a specific user:

```tsx
import { useUserPresence } from '@veroai/chat/react';

function UserStatus({ userId }) {
  const { status, isOnline } = useUserPresence(userId);

  return (
    <span className={isOnline ? 'text-green-500' : 'text-gray-400'}>
      {status}
    </span>
  );
}
```

## Types

```typescript
// User types
type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isVirtual?: boolean;
  agentConfigId?: string;
  status?: PresenceStatus;
  statusMessage?: string;
  lastSeen?: string;
}

// Conversation types
type ConversationType = 'direct' | 'group' | 'channel' | 'support';

interface Conversation {
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
}

// Message types
type MessageType = 'text' | 'system' | 'agent' | 'file' | 'call';

interface Message {
  id: string;
  conversationId: string;
  content: string;
  messageType: MessageType;
  senderId?: string;
  sender?: User;
  readBy?: ReadReceipt[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// Call types
type CallAction = 'ring' | 'accept' | 'reject' | 'end';
type CallType = 'audio' | 'video';

interface CallEvent {
  conversationId: string;
  userId: string;
  action: CallAction;
  callType?: CallType;
  roomName?: string;
}

// Room info (for Vero Voice)
interface RoomInfo {
  name: string;
  wsUrl: string;
  token: string;
}
```

## Advanced Usage

### Custom Token Refresh

```typescript
const chat = new ChatClient({
  apiUrl: 'https://api.veroai.dev',
  wsUrl: 'wss://ws.veroai.dev',
  getToken: async () => {
    // Check if token is expired
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
  apiUrl: 'https://api.veroai.dev',
  getToken: () => localStorage.getItem('token'),
});

// Use API directly without WebSocket
const conversations = await api.listConversations();
const room = await api.createRoom({ name: 'my-room' });
```

### Direct WebSocket Access

For custom WebSocket handling:

```typescript
import { WebSocketManager } from '@veroai/chat';

const ws = new WebSocketManager({
  url: 'wss://ws.veroai.dev',
  getToken: () => localStorage.getItem('token'),
  autoReconnect: true,
  heartbeatInterval: 30000,
});

await ws.connect();
ws.on('message:new', handleNewMessage);
ws.sendTypingStart(conversationId);
ws.sendCallNotification(conversationId, 'ring', 'video', roomName);
```

## License

MIT
