/**
 * usePresence Hook
 *
 * Track and manage user presence/online status
 */

import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../provider';
import type { User, PresenceStatus, PresenceEvent } from '../../types';

export interface UsePresenceReturn {
  /** Online users */
  onlineUsers: User[];
  /** Whether loading online users */
  isLoading: boolean;
  /** Get presence status for a specific user */
  getUserStatus: (userId: string) => PresenceStatus;
  /** Refresh online users list */
  refresh: () => Promise<void>;
  /** Error if any */
  error: Error | null;
}

/**
 * usePresence - Track online users and presence
 *
 * @example
 * ```tsx
 * function OnlineUsers() {
 *   const { onlineUsers, getUserStatus } = usePresence();
 *
 *   return (
 *     <div>
 *       {onlineUsers.map(user => (
 *         <div key={user.id}>
 *           {user.firstName} - {getUserStatus(user.id)}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePresence(): UsePresenceReturn {
  const { client } = useChat();

  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(new Map());

  // Fetch online users
  const refresh = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      const users = await client.getOnlineUsers();
      setOnlineUsers(users);

      // Update presence map
      const newMap = new Map<string, PresenceStatus>();
      users.forEach((user) => {
        if (user.status) {
          newMap.set(user.id, user.status);
        }
      });
      setPresenceMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('[usePresence] Failed to fetch online users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Initial fetch
  useEffect(() => {
    if (client) {
      refresh();
    }
  }, [client, refresh]);

  // Listen for presence updates
  useEffect(() => {
    if (!client) return;

    const handlePresenceUpdate = ({ userId, status }: PresenceEvent) => {
      setPresenceMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, status);
        return newMap;
      });

      // Update online users list
      if (status === 'offline') {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        // If user came online, refresh to get their info
        setOnlineUsers((prev) => {
          const exists = prev.some((u) => u.id === userId);
          if (!exists) {
            // Trigger a refresh to get the new online user
            refresh();
          }
          return prev.map((u) =>
            u.id === userId ? { ...u, status } : u
          );
        });
      }
    };

    client.on('presence:updated', handlePresenceUpdate);

    return () => {
      client.off('presence:updated', handlePresenceUpdate);
    };
  }, [client, refresh]);

  // Get status for a specific user
  const getUserStatus = useCallback(
    (userId: string): PresenceStatus => {
      return presenceMap.get(userId) || 'offline';
    },
    [presenceMap]
  );

  return {
    onlineUsers,
    isLoading,
    getUserStatus,
    refresh,
    error,
  };
}

/**
 * useUserPresence - Track presence for a specific user
 */
export function useUserPresence(userId: string | undefined): {
  status: PresenceStatus;
  isOnline: boolean;
} {
  const { client } = useChat();
  const [status, setStatus] = useState<PresenceStatus>('offline');

  useEffect(() => {
    if (!client || !userId) return;

    // Fetch initial status
    client.getUser(userId)
      .then((user) => {
        setStatus(user.status || 'offline');
      })
      .catch(console.error);

    // Listen for updates
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
