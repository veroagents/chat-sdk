/**
 * usePresence Hook
 *
 * Track user presence/online status via WebSocket events.
 * The chat backend is user-agnostic - presence is tracked via real-time events only.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '../provider';
import type { PresenceStatus, PresenceEvent } from '../../types';

export interface UsePresenceOptions {
  /** User IDs that should always appear as online (e.g., virtual agent users) */
  alwaysOnlineUserIds?: string[];
}

export interface UsePresenceReturn {
  /** Map of userId to their presence status */
  presenceMap: Map<string, PresenceStatus>;
  /** Get presence status for a specific user */
  getUserStatus: (userId: string) => PresenceStatus;
  /** Set user IDs that should always appear as online */
  setAlwaysOnlineUserIds: (userIds: string[]) => void;
}

/**
 * usePresence - Track user presence via WebSocket events
 *
 * Note: The chat backend is user-agnostic. This hook only tracks presence
 * updates received via WebSocket. To know who is online, you need to
 * implement presence tracking in your own system.
 *
 * @param options - Configuration options
 * @param options.alwaysOnlineUserIds - User IDs that should always appear online (e.g., AI agents)
 *
 * @example
 * ```tsx
 * function UserStatus({ userId }: { userId: string }) {
 *   // Pass agent IDs from conversation participants
 *   const agentIds = participants.filter(p => p.isVirtual).map(p => p.id);
 *   const { getUserStatus } = usePresence({ alwaysOnlineUserIds: agentIds });
 *   const status = getUserStatus(userId);
 *
 *   return <span className={`status-${status}`}>{status}</span>;
 * }
 * ```
 */
export function usePresence(options?: UsePresenceOptions): UsePresenceReturn {
  const { client } = useChat();

  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(new Map());
  const [alwaysOnlineUserIds, setAlwaysOnlineUserIds] = useState<string[]>(
    options?.alwaysOnlineUserIds || []
  );

  // Update always-online IDs when options change
  useEffect(() => {
    if (options?.alwaysOnlineUserIds) {
      setAlwaysOnlineUserIds(options.alwaysOnlineUserIds);
    }
  }, [options?.alwaysOnlineUserIds]);

  // Create a Set for O(1) lookup of always-online users
  const alwaysOnlineSet = useMemo(
    () => new Set(alwaysOnlineUserIds),
    [alwaysOnlineUserIds]
  );

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
      // Always-online users (e.g., virtual agents) are always shown as online
      if (alwaysOnlineSet.has(userId)) {
        return 'online';
      }
      return presenceMap.get(userId) || 'offline';
    },
    [presenceMap, alwaysOnlineSet]
  );

  return {
    presenceMap,
    getUserStatus,
    setAlwaysOnlineUserIds,
  };
}

export interface UseUserPresenceOptions {
  /** If true, this user should always appear as online (e.g., virtual agent user) */
  alwaysOnline?: boolean;
}

/**
 * useUserPresence - Track presence for a specific user via WebSocket events
 *
 * @param userId - The user ID to track
 * @param options - Configuration options
 * @param options.alwaysOnline - If true, user will always appear online (for AI agents)
 *
 * @example
 * ```tsx
 * // For a regular user
 * const { status, isOnline } = useUserPresence(user.id);
 *
 * // For an agent/virtual user - always show as online
 * const { status, isOnline } = useUserPresence(agent.id, { alwaysOnline: agent.isVirtual });
 * ```
 */
export function useUserPresence(
  userId: string | undefined,
  options?: UseUserPresenceOptions
): {
  status: PresenceStatus;
  isOnline: boolean;
} {
  const { client } = useChat();
  const [status, setStatus] = useState<PresenceStatus>(
    options?.alwaysOnline ? 'online' : 'offline'
  );

  // If alwaysOnline option changes, update status
  useEffect(() => {
    if (options?.alwaysOnline) {
      setStatus('online');
    }
  }, [options?.alwaysOnline]);

  useEffect(() => {
    // If alwaysOnline, don't listen to WebSocket events
    if (options?.alwaysOnline) return;
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
  }, [client, userId, options?.alwaysOnline]);

  return {
    status: options?.alwaysOnline ? 'online' : status,
    isOnline: options?.alwaysOnline || status !== 'offline',
  };
}
