/**
 * useStreamingChat Hook
 *
 * Manage streaming AI responses for a conversation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from '../provider';
import type {
  StreamStartEvent,
  StreamChunkEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamMetadata,
} from '../../types';

export interface UseStreamingChatOptions {
  /** Conversation ID to use for streaming */
  conversationId?: string;
  /** Agent config ID (optional, uses default if not specified) */
  agentConfigId?: string;
  /** Callback when streaming starts */
  onStart?: (event: StreamStartEvent) => void;
  /** Callback on each chunk */
  onChunk?: (event: StreamChunkEvent) => void;
  /** Callback when streaming ends */
  onEnd?: (event: StreamEndEvent) => void;
  /** Callback on error */
  onError?: (event: StreamErrorEvent) => void;
}

export interface UseStreamingChatReturn {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current streaming text (accumulated) */
  streamingText: string;
  /** Metadata from completed stream */
  metadata: StreamMetadata | null;
  /** Error if any */
  error: string | null;
  /** Current execution ID if streaming */
  executionId: string | null;
  /** Send a streaming message */
  sendStreamingMessage: (content: string) => string;
  /** Cancel the current stream */
  cancelStream: () => void;
  /** Reset state (clear accumulated text, error, etc.) */
  reset: () => void;
}

/**
 * useStreamingChat - Manage streaming AI responses
 *
 * @example
 * ```tsx
 * function ChatWithAI({ conversationId }) {
 *   const {
 *     isStreaming,
 *     streamingText,
 *     sendStreamingMessage,
 *     cancelStream,
 *   } = useStreamingChat({ conversationId });
 *
 *   const handleSubmit = (message: string) => {
 *     sendStreamingMessage(message);
 *   };
 *
 *   return (
 *     <div>
 *       {streamingText && <div className="streaming">{streamingText}</div>}
 *       {isStreaming && <button onClick={cancelStream}>Stop</button>}
 *       <input onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e.target.value)} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useStreamingChat(
  options: UseStreamingChatOptions = {}
): UseStreamingChatReturn {
  const {
    conversationId,
    agentConfigId,
    onStart,
    onChunk,
    onEnd,
    onError,
  } = options;

  const { client } = useChat();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [metadata, setMetadata] = useState<StreamMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

  // Use ref to track current execution ID for event handlers
  const currentExecutionIdRef = useRef<string | null>(null);

  // Subscribe to streaming events
  useEffect(() => {
    if (!client) return;

    const handleStreamStart = (event: StreamStartEvent) => {
      if (event.executionId !== currentExecutionIdRef.current) return;

      setIsStreaming(true);
      setError(null);
      onStart?.(event);
    };

    const handleStreamChunk = (event: StreamChunkEvent) => {
      if (event.executionId !== currentExecutionIdRef.current) return;

      setStreamingText(event.accumulated);
      onChunk?.(event);
    };

    const handleStreamEnd = (event: StreamEndEvent) => {
      if (event.executionId !== currentExecutionIdRef.current) return;

      setIsStreaming(false);
      setStreamingText(event.accumulated);
      setMetadata(event.metadata ?? null);
      currentExecutionIdRef.current = null;
      onEnd?.(event);
    };

    const handleStreamError = (event: StreamErrorEvent) => {
      if (event.executionId !== currentExecutionIdRef.current) return;

      setIsStreaming(false);
      setError(event.error);
      currentExecutionIdRef.current = null;
      onError?.(event);
    };

    client.on('stream:start', handleStreamStart);
    client.on('stream:chunk', handleStreamChunk);
    client.on('stream:end', handleStreamEnd);
    client.on('stream:error', handleStreamError);

    return () => {
      client.off('stream:start', handleStreamStart);
      client.off('stream:chunk', handleStreamChunk);
      client.off('stream:end', handleStreamEnd);
      client.off('stream:error', handleStreamError);
    };
  }, [client, onStart, onChunk, onEnd, onError]);

  // Send streaming message
  const sendStreamingMessage = useCallback(
    (content: string): string => {
      if (!client) {
        throw new Error('Chat client not available');
      }
      if (!conversationId) {
        throw new Error('No conversation ID specified');
      }

      // Reset state for new stream
      setStreamingText('');
      setMetadata(null);
      setError(null);

      // Send the streaming request
      const execId = client.sendStreamingMessage(conversationId, content, agentConfigId);

      setExecutionId(execId);
      currentExecutionIdRef.current = execId;

      return execId;
    },
    [client, conversationId, agentConfigId]
  );

  // Cancel stream
  const cancelStream = useCallback(() => {
    if (!client || !currentExecutionIdRef.current) return;

    client.cancelStream(currentExecutionIdRef.current);
    setIsStreaming(false);
    currentExecutionIdRef.current = null;
  }, [client]);

  // Reset state
  const reset = useCallback(() => {
    if (currentExecutionIdRef.current && client) {
      client.cancelStream(currentExecutionIdRef.current);
    }

    setIsStreaming(false);
    setStreamingText('');
    setMetadata(null);
    setError(null);
    setExecutionId(null);
    currentExecutionIdRef.current = null;
  }, [client]);

  return {
    isStreaming,
    streamingText,
    metadata,
    error,
    executionId,
    sendStreamingMessage,
    cancelStream,
    reset,
  };
}
