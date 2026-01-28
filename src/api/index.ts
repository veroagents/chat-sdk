/**
 * VeroAI Chat API Client
 *
 * HTTP client for the VeroAI Chat API
 */

import type {
  Conversation,
  CreateConversationParams,
  Message,
  SendMessageParams,
  GetMessagesParams,
  PaginatedMessages,
  User,
  UserPresence,
  PresenceStatus,
  AgentConfig,
} from '../types';

export interface ApiClientConfig {
  apiUrl: string;
  getToken: () => string | null | Promise<string | null>;
}

/**
 * Chat API Client for HTTP requests
 */
export class ChatApi {
  private apiUrl: string;
  private getToken: () => string | null | Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  // ============================================================================
  // Conversations
  // ============================================================================

  /**
   * List all conversations for the current user
   */
  async listConversations(): Promise<Conversation[]> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ conversations: RawConversation[] }>(response);
    return data.conversations.map(transformConversation);
  }

  /**
   * Get a specific conversation
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ conversation: RawConversation }>(response);
    return transformConversation(data.conversation);
  }

  /**
   * Create a new conversation
   */
  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        type: params.type || 'direct',
        name: params.name,
        participant_ids: params.participantIds,
        agent_config_id: params.agentConfigId,
        metadata: params.metadata,
      }),
    });
    const data = await this.handleResponse<{ conversation: RawConversation }>(response);
    return transformConversation(data.conversation);
  }

  /**
   * Mark conversation as read
   */
  async markConversationRead(conversationId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: await this.getHeaders(),
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Leave a conversation
   */
  async leaveConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      `${this.apiUrl}/v1/chat/conversations/${conversationId}/participants/me`,
      {
        method: 'DELETE',
        headers: await this.getHeaders(),
      }
    );
    await this.handleResponse<void>(response);
  }

  // ============================================================================
  // Messages
  // ============================================================================

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, params?: GetMessagesParams): Promise<PaginatedMessages> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.before) searchParams.set('before', params.before);

    const url = `${this.apiUrl}/v1/chat/conversations/${conversationId}/messages?${searchParams}`;
    const response = await fetch(url, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<RawPaginatedMessages>(response);
    return {
      messages: data.messages.map(transformMessage),
      total: data.total,
      hasMore: data.has_more,
      limit: data.limit,
      offset: data.offset,
    };
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(conversationId: string, params: SendMessageParams): Promise<Message> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        content: params.content,
        message_type: params.messageType || 'text',
        metadata: params.metadata,
      }),
    });
    const data = await this.handleResponse<{ message: RawMessage }>(response);
    return transformMessage(data.message);
  }

  // ============================================================================
  // Users
  // ============================================================================

  /**
   * List all users (contacts)
   */
  async listUsers(options?: { includeVirtual?: boolean }): Promise<User[]> {
    const searchParams = new URLSearchParams();
    if (options?.includeVirtual) searchParams.set('include_virtual', 'true');

    const url = `${this.apiUrl}/v1/chat/users?${searchParams}`;
    const response = await fetch(url, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ users: RawUser[] }>(response);
    return data.users.map(transformUser);
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<User[]> {
    const response = await fetch(`${this.apiUrl}/v1/chat/users/online`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ users: RawUser[] }>(response);
    return data.users.map(transformUser);
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${this.apiUrl}/v1/chat/users/me`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ user: RawUser }>(response);
    return transformUser(data.user);
  }

  /**
   * Get a specific user
   */
  async getUser(userId: string): Promise<User> {
    const response = await fetch(`${this.apiUrl}/v1/chat/users/${userId}`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<{ user: RawUser }>(response);
    return transformUser(data.user);
  }

  /**
   * Update current user's presence status
   */
  async updateStatus(status: PresenceStatus, statusMessage?: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/chat/users/me/status`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        status,
        status_message: statusMessage,
      }),
    });
    await this.handleResponse<void>(response);
  }

  // ============================================================================
  // Agents
  // ============================================================================

  /**
   * Add agent to conversation
   */
  async addAgentToConversation(
    conversationId: string,
    agentConfigId: string,
    addAsParticipant = true
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}/agent`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        agent_config_id: agentConfigId,
        add_as_participant: addAsParticipant,
      }),
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Remove agent from conversation
   */
  async removeAgentFromConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}/agent`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Toggle agent enabled/disabled
   */
  async toggleAgent(conversationId: string, enabled: boolean): Promise<void> {
    const response = await fetch(`${this.apiUrl}/v1/chat/conversations/${conversationId}/agent`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    await this.handleResponse<void>(response);
  }

  /**
   * List available agents
   */
  async listAgents(): Promise<AgentConfig[]> {
    const response = await fetch(`${this.apiUrl}/v1/agent-configurations`, {
      headers: await this.getHeaders(),
    });
    const data = await this.handleResponse<AgentConfig[]>(response);
    return data;
  }

  // ============================================================================
  // Voice Rooms (LiveKit)
  // ============================================================================

  /**
   * Create a new voice/video room
   */
  async createRoom(params: {
    name: string;
    emptyTimeout?: number;
    maxParticipants?: number;
  }): Promise<RoomInfo> {
    const response = await fetch(`${this.apiUrl}/v1/voice/rooms`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        name: params.name,
        empty_timeout: params.emptyTimeout,
        max_participants: params.maxParticipants,
      }),
    });
    const data = await this.handleResponse<{ room: RawRoomInfo }>(response);
    return transformRoomInfo(data.room);
  }

  /**
   * Join an existing room and get access token
   */
  async joinRoom(params: {
    roomName: string;
    participantName: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
  }): Promise<RoomInfo> {
    const response = await fetch(
      `${this.apiUrl}/v1/voice/rooms/${encodeURIComponent(params.roomName)}/join`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          participant_name: params.participantName,
          can_publish: params.canPublish ?? true,
          can_subscribe: params.canSubscribe ?? true,
        }),
      }
    );
    const data = await this.handleResponse<RawJoinRoomResponse>(response);
    return {
      name: data.room_name,
      wsUrl: data.ws_url,
      token: data.token,
    };
  }

  /**
   * Get room token for an existing room
   * Convenience method for getting a token without creating
   */
  async getRoomToken(roomName: string, participantName: string): Promise<RoomInfo> {
    return this.joinRoom({ roomName, participantName });
  }
}

// ============================================================================
// Raw API Types (snake_case from server)
// ============================================================================

interface RawUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_virtual?: boolean;
  agent_config_id?: string;
  status?: PresenceStatus;
  status_message?: string;
  last_seen?: string;
  created_at?: string;
}

interface RawParticipant {
  user_id: string;
  role: 'admin' | 'member';
  is_active: boolean;
  joined_at?: string;
  last_seen?: string;
  user?: RawUser;
}

interface RawConversation {
  id: string;
  name?: string;
  type: string;
  is_active: boolean;
  last_message_at?: string;
  agent_enabled?: boolean;
  agent_config_id?: string;
  participants?: RawParticipant[];
  unread_count?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface RawReadReceipt {
  user_id: string;
  read_at?: string;
}

interface RawMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: string;
  sender_id?: string;
  sender?: RawUser;
  read_by?: RawReadReceipt[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  edited_at?: string;
}

interface RawPaginatedMessages {
  messages: RawMessage[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
}

interface RawRoomInfo {
  id?: string;
  name: string;
  ws_url: string;
  token: string;
}

interface RawJoinRoomResponse {
  room_name: string;
  ws_url: string;
  token: string;
}

// Exported room types
export interface RoomInfo {
  name: string;
  wsUrl: string;
  token: string;
}

// ============================================================================
// Transform Functions (snake_case to camelCase)
// ============================================================================

function transformUser(raw: RawUser): User {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    isVirtual: raw.is_virtual,
    agentConfigId: raw.agent_config_id,
    status: raw.status,
    statusMessage: raw.status_message,
    lastSeen: raw.last_seen,
    createdAt: raw.created_at,
  };
}

function transformParticipant(raw: RawParticipant) {
  return {
    userId: raw.user_id,
    role: raw.role,
    isActive: raw.is_active,
    joinedAt: raw.joined_at,
    lastSeen: raw.last_seen,
    user: raw.user ? transformUser(raw.user) : undefined,
  };
}

function transformConversation(raw: RawConversation): Conversation {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as Conversation['type'],
    isActive: raw.is_active,
    lastMessageAt: raw.last_message_at,
    agentEnabled: raw.agent_enabled,
    agentConfigId: raw.agent_config_id,
    participants: raw.participants?.map(transformParticipant),
    unreadCount: raw.unread_count,
    metadata: raw.metadata,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    content: raw.content,
    messageType: raw.message_type as Message['messageType'],
    senderId: raw.sender_id,
    sender: raw.sender ? transformUser(raw.sender) : undefined,
    readBy: raw.read_by?.map((r) => ({
      userId: r.user_id,
      readAt: r.read_at,
    })),
    metadata: raw.metadata,
    createdAt: raw.created_at,
    editedAt: raw.edited_at,
  };
}

function transformRoomInfo(raw: RawRoomInfo): RoomInfo {
  return {
    name: raw.name,
    wsUrl: raw.ws_url,
    token: raw.token,
  };
}
