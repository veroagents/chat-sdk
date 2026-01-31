/**
 * usePresence Hook
 *
 * Track user presence/online status via WebSocket events.
 * The chat backend is user-agnostic - presence is tracked via real-time events only.
 */

import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../provider';
import type { PresenceStatus, PresenceEvent } from '../../types';

export interface UsePresenceReturn {
  /** Map of userId to their presence status */
  presenceMap: Map<string, PresenceStatus>;
  /** Get presence status for a specific user */
  getUserStatus: (userId: string) => PresenceStatus;
}

/**
 * usePresence - Track user presence via WebSocket events
 *
 * Note: The chat backend is user-agnostic. This hook only tracks presence
 * updates received via WebSocket. To know who is online, you need to
 * implement presence tracking in your own system.
 *
 * @example
 * ```tsx
 * function UserStatus({ userId }: { userId: string }) {
 *   const { getUserStatus } = usePresence();
 *   const status = getUserStatus(userId);
 *
 *   return <span className={`status-${status}`}>{status}</span>;
 * }
 * ```
 */
export function usePresence(): UsePresenceReturn {
  const { client } = useChat();

  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(new Map());

  // Listen for presence updates via WebSocket
  useEffect(() => {
    if (!client) return;

    const handlePresenceUpdate = ({ userId, status }: PresenceEvent) => {
      setPresenceMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, status);
        return newMap;
      });
    };

    client.on('presence:updated', handlePresenceUpdate);

    return () => {
      client.off('presence:updated', handlePresenceUpdate);
    };
  }, [client]);

  // Get status for a specific user
  const getUserStatus = useCallback(
    (userId: string): PresenceStatus => {
      return presenceMap.get(userId) || 'offline';
    },
    [presenceMap]
  );

  return {
    presenceMap,
    getUserStatus,
  };
}

/**
 * useUserPresence - Track presence for a specific user via WebSocket events
 */
export function useUserPresence(userId: string | undefined): {
  status: PresenceStatus;
  isOnline: boolean;
} {
  const { client } = useChat();
  const [status, setStatus] = useState<PresenceStatus>('offline');

  useEffect(() => {
    if (!client || !userId) return;

    // Listen for updates via WebSocket
    const handlePresenceUpdate = ({ userId: eventUserId, status: newStatus }: PresenceEvent) => {
      if (eventUserId === userId) {
        setStatus(newStatus);
      }
    };

    client.on('presence:updated', handlePresenceUpdate);

    return () => {
      client.off('presence:updated', handlePresenceUpdate);
    };
  }, [client, userId]);

  return {
    status,
    isOnline: status !== 'offline',
  };
}
