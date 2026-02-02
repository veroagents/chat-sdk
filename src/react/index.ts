/**
 * VeroAI Chat React Integration
 *
 * React components and hooks for building chat interfaces
 */

// Provider
export { ChatProvider, useChat, useChatClient } from './provider';
export type { ChatProviderProps, ChatContextValue } from './provider';

// Hooks
export {
  useConversation,
  usePresence,
  useUserPresence,
  useStreamingChat,
} from './hooks';
export type {
  UseConversationOptions,
  UseConversationReturn,
  UsePresenceOptions,
  UsePresenceReturn,
  UseUserPresenceOptions,
  UseStreamingChatOptions,
  UseStreamingChatReturn,
} from './hooks';
