/**
 * useConversation Hook
 *
 * Manage a single conversation with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../provider';
import type { Conversation, Message, SendMessageParams, PaginatedMessages, TypingEvent } from '../../types';

export interface UseConversationOptions {
  /** Auto-fetch messages on mount */
  autoFetchMessages?: boolean;
  /** Number of messages to fetch initially */
  initialMessageLimit?: number;
  /** Auto-subscribe to real-time updates */
  autoSubscribe?: boolean;
}

export interface UseConversationReturn {
  /** The conversation object */
  conversation: Conversation | null;
  /** Messages in the conversation */
  messages: Message[];
  /** Whether messages are loading */
  isLoading: boolean;
  /** Whether more messages are available */
  hasMore: boolean;
  /** Users currently typing */
  typingUsers: string[];
  /** Send a message */
  sendMessage: (params: SendMessageParams) => Promise<Message>;
  /** Send a text message (convenience) */
  send: (content: string) => Promise<Message>;
  /** Load more (older) messages */
  loadMore: () => Promise<void>;
  /** Refresh messages from server */
  refresh: () => Promise<void>;
  /** Mark conversation as read */
  markAsRead: () => Promise<void>;
  /** Start typing indicator */
  startTyping: () => void;
  /** Stop typing indicator */
  stopTyping: () => void;
  /** Error if any */
  error: Error | null;
}

/**
 * useConversation - Manage a single conversation
 *
 * @example
 * ```tsx
 * function ChatRoom({ conversationId }) {
 *   const {
 *     messages,
 *     send,
 *     isLoading,
 *     typingUsers,
 *   } = useConversation(conversationId);
 *
 *   return (
 *     <div>
 *       {messages.map(m => <Message key={m.id} message={m} />)}
 *       {typingUsers.length > 0 && <div>Someone is typing...</div>}
 *       <input onKeyDown={(e) => e.key === 'Enter' && send(e.target.value)} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useConversation(
  conversationId: string | undefined,
  options: UseConversationOptions = {}
): UseConversationReturn {
  const {
    autoFetchMessages = true,
    initialMessageLimit = 50,
    autoSubscribe = true,
  } = options;

  const { client, conversations } = useChat();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Get conversation from context or fetch
  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      return;
    }

    // Try to find in existing conversations
    const existing = conversations.find((c) => c.id === conversationId);
    if (existing) {
      setConversation(existing);
    } else if (client) {
      // Fetch from server
      client.getConversation(conversationId)
        .then(setConversation)
        .catch((err) => {
          setError(err);
          console.error('[useConversation] Failed to fetch conversation:', err);
        });
    }
  }, [conversationId, conversations, client]);

  // Fetch messages
  const fetchMessages = useCallback(async (before?: string) => {
    if (!client || !conversationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.getMessages(conversationId, {
        limit: initialMessageLimit,
        before,
      });

      if (before) {
        // Append older messages
        setMessages((prev) => [...prev, ...result.messages]);
      } else {
        // Initial load
        setMessages(result.messages);
      }

      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('[useConversation] Failed to fetch messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, conversationId, initialMessageLimit]);

  // Auto-fetch messages
  useEffect(() => {
    if (autoFetchMessages && conversationId && client) {
      fetchMessages();
    }
  }, [autoFetchMessages, conversationId, client, fetchMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!client || !conversationId || !autoSubscribe) return;

    client.subscribeToConversation(conversationId);

    // Handle new messages
    const handleNewMessage = ({ message, conversationId: convId }: { message: Message; conversationId: string }) => {
      if (convId === conversationId) {
        setMessages((prev) => [message, ...prev]);
      }
    };

    // Handle message updates
    const handleMessageUpdated = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? message : m))
        );
      }
    };

    // Handle message deletion
    const handleMessageDeleted = (messageId: string, convId: string) => {
      if (convId === conversationId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    };

    // Handle typing indicators
    const handleTypingStart = ({ conversationId: convId, userId }: TypingEvent) => {
      if (convId === conversationId) {
        setTypingUsers((prev) =>
          prev.includes(userId) ? prev : [...prev, userId]
        );
      }
    };

    const handleTypingStop = ({ conversationId: convId, userId }: TypingEvent) => {
      if (convId === conversationId) {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }
    };

    client.on('message:new', handleNewMessage);
    client.on('message:updated', handleMessageUpdated);
    client.on('message:deleted', handleMessageDeleted);
    client.on('typing:start', handleTypingStart);
    client.on('typing:stop', handleTypingStop);

    return () => {
      client.unsubscribeFromConversation(conversationId);
      client.off('message:new', handleNewMessage);
      client.off('message:updated', handleMessageUpdated);
      client.off('message:deleted', handleMessageDeleted);
      client.off('typing:start', handleTypingStart);
      client.off('typing:stop', handleTypingStop);
    };
  }, [client, conversationId, autoSubscribe]);

  // Send message
  const sendMessage = useCallback(
    async (params: SendMessageParams): Promise<Message> => {
      if (!client || !conversationId) {
        throw new Error('No conversation selected');
      }
      return client.sendMessage(conversationId, params);
    },
    [client, conversationId]
  );

  // Send text message
  const send = useCallback(
    async (content: string): Promise<Message> => {
      return sendMessage({ content });
    },
    [sendMessage]
  );

  // Load more messages
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || messages.length === 0) return;

    const oldestMessage = messages[messages.length - 1];
    await fetchMessages(oldestMessage.createdAt);
  }, [hasMore, isLoading, messages, fetchMessages]);

  // Refresh messages
  const refresh = useCallback(async () => {
    setMessages([]);
    setHasMore(true);
    await fetchMessages();
  }, [fetchMessages]);

  // Mark as read
  const markAsRead = useCallback(async () => {
    if (!client || !conversationId) return;
    await client.markConversationRead(conversationId);
  }, [client, conversationId]);

  // Typing indicators
  const startTyping = useCallback(() => {
    if (conversationId) {
      client?.sendTypingStart(conversationId);
    }
  }, [client, conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId) {
      client?.sendTypingStop(conversationId);
    }
  }, [client, conversationId]);

  return {
    conversation,
    messages,
    isLoading,
    hasMore,
    typingUsers,
    sendMessage,
    send,
    loadMore,
    refresh,
    markAsRead,
    startTyping,
    stopTyping,
    error,
  };
}
