/**
 * VeroAI Chat React Provider
 *
 * Provides ChatClient context to React components
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ChatClient } from '../client';
import type { ChatClientConfig, Conversation, Message, User, PresenceStatus } from '../types';

// ============================================================================
// Context Types
// ============================================================================

export interface ChatContextValue {
  /** The ChatClient instance */
  client: ChatClient | null;
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Current user profile */
  currentUser: User | null;
  /** List of conversations */
  conversations: Conversation[];
  /** Loading state for conversations */
  isLoadingConversations: boolean;
  /** Refresh conversations from server */
  refreshConversations: () => Promise<void>;
  /** Connect to WebSocket */
  connect: () => Promise<void>;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Update current user's status */
  updateStatus: (status: PresenceStatus, statusMessage?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface ChatProviderProps {
  children: React.ReactNode;
  /** ChatClient configuration */
  config: ChatClientConfig;
  /** Auto-fetch conversations on mount */
  autoFetchConversations?: boolean;
  /** Auto-fetch current user on mount */
  autoFetchCurrentUser?: boolean;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * ChatProvider - Provides chat functionality to React components
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ChatProvider
 *       config={{
 *         apiUrl: 'https://api.veroai.dev',
 *         wsUrl: 'wss://ws.veroai.dev',
 *         token: authToken,
 *       }}
 *     >
 *       <ChatApp />
 *     </ChatProvider>
 *   );
 * }
 * ```
 */
export function ChatProvider({
  children,
  config,
  autoFetchConversations = true,
  autoFetchCurrentUser = true,
}: ChatProviderProps) {
  const [client, setClient] = useState<ChatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const clientRef = useRef<ChatClient | null>(null);

  // Initialize client
  useEffect(() => {
    const chatClient = new ChatClient({
      ...config,
      autoConnect: false, // We'll connect manually to handle state
    });

    clientRef.current = chatClient;
    setClient(chatClient);

    // Set up event listeners
    chatClient.on('connected', () => setIsConnected(true));
    chatClient.on('disconnected', () => setIsConnected(false));

    // Handle real-time conversation updates
    chatClient.on('conversation:created', (conv) => {
      setConversations((prev) => [conv, ...prev]);
    });

    chatClient.on('conversation:updated', (conv) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? conv : c))
      );
    });

    // Handle new messages - update conversation's lastMessageAt
    chatClient.on('message:new', ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
    });

    // Connect if wsUrl provided
    if (config.wsUrl && config.autoConnect !== false) {
      chatClient.connect().catch(console.error);
    }

    return () => {
      chatClient.disconnect();
      chatClient.removeAllListeners();
    };
  }, [config.apiUrl, config.wsUrl, config.token]);

  // Fetch current user
  useEffect(() => {
    if (!client || !autoFetchCurrentUser) return;

    client.getCurrentUser()
      .then(setCurrentUser)
      .catch(console.error);
  }, [client, autoFetchCurrentUser]);

  // Fetch conversations
  const refreshConversations = useCallback(async () => {
    if (!client) return;

    setIsLoadingConversations(true);
    try {
      const convs = await client.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('[ChatProvider] Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [client]);

  useEffect(() => {
    if (autoFetchConversations && client) {
      refreshConversations();
    }
  }, [autoFetchConversations, client, refreshConversations]);

  // Connect function
  const connect = useCallback(async () => {
    if (client) {
      await client.connect();
    }
  }, [client]);

  // Disconnect function
  const disconnect = useCallback(() => {
    client?.disconnect();
  }, [client]);

  // Update status
  const updateStatus = useCallback(
    async (status: PresenceStatus, statusMessage?: string) => {
      if (client) {
        await client.updateStatus(status, statusMessage);
        setCurrentUser((prev) =>
          prev ? { ...prev, status, statusMessage } : prev
        );
      }
    },
    [client]
  );

  const value: ChatContextValue = {
    client,
    isConnected,
    currentUser,
    conversations,
    isLoadingConversations,
    refreshConversations,
    connect,
    disconnect,
    updateStatus,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useChat - Access chat context
 *
 * @example
 * ```tsx
 * function ChatList() {
 *   const { conversations, isConnected } = useChat();
 *   return <div>{conversations.map(c => <div key={c.id}>{c.name}</div>)}</div>;
 * }
 * ```
 */
export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

/**
 * useChatClient - Access the ChatClient instance directly
 */
export function useChatClient(): ChatClient | null {
  const { client } = useChat();
  return client;
}
