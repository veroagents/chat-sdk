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
} from './hooks';
export type {
  UseConversationOptions,
  UseConversationReturn,
  UsePresenceReturn,
} from './hooks';
