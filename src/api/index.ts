/**
 * @veroai/chat — HTTP API Client
 *
 * Wraps msgsrv REST endpoints (proxied through api.veroagents.com/v1/chat/*).
 * All snake_case responses are transformed to camelCase before returning.
 */

import {
  ChatApiError,
  type Message,
  type Conversation,
  type Participant,
  type User,
  type Agent,
  type SendMessageParams,
  type GetMessagesParams,
  type GetMessagesResponse,
  type SyncConversation,
  type SyncResponse,
  type CreateConversationParams,
  type CreateConversationResponse,
  type UpdateConversationParams,
  type ToggleReactionResponse,
  type ForwardResponse,
  type MessagingTokenResponse,
  type DeleteMode,
  type ReactionGroup,
  type ContentType,
  type SenderType,
  type ThreadRole,
  type ConversationType,
  type EditMessageParams,
  type EditMessageResponse,
  type TypingState,
  type UnreadCountsResponse,
  type SearchMessagesParams,
  type SearchMessagesResponse,
  type SearchResult,
  type MuteParams,
  type MuteResponse,
  type ArchiveResponse,
  type ListBlockedResponse,
} from '../types';

export interface ChatApiConfig {
  apiUrl: string;
  getToken: () => string | null | Promise<string | null>;
}

export class ChatApi {
  private baseUrl: string;
  private getToken: () => string | null | Promise<string | null>;

  constructor(config: ChatApiConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
  }

  // --------------------------------------------------------------------------
  // Messages
  // --------------------------------------------------------------------------

  /** Send a message. POST /v1/chat/messages/send */
  async send(params: SendMessageParams): Promise<Message> {
    const raw = await this.post('/v1/chat/messages/send', {
      conversation_id: params.conversationId,
      content_text: params.contentText,
      content_type: params.contentType,
      content_meta: params.contentMeta,
      reply_to_id: params.replyToId,
      thread_role: params.threadRole,
      task_id: params.taskId,
    });
    return transformMessage(raw);
  }

  /** Get messages for a conversation. GET /v1/chat/conversations/:id/messages */
  async getMessages(conversationId: string, opts?: GetMessagesParams): Promise<GetMessagesResponse> {
    const params = new URLSearchParams();
    if (opts?.fromSeq != null) params.set('from_seq', String(opts.fromSeq));
    if (opts?.toSeq != null) params.set('to_seq', String(opts.toSeq));
    if (opts?.limit != null) params.set('limit', String(opts.limit));

    const qs = params.toString();
    const url = `/v1/chat/conversations/${conversationId}/messages${qs ? '?' + qs : ''}`;
    const raw = await this.get(url);
    return {
      messages: (raw.messages ?? []).map(transformMessage),
      currentSeq: raw.current_seq ?? 0,
    };
  }

  /** Batch sync multiple conversations. POST /v1/chat/messages/sync */
  async sync(conversations: SyncConversation[]): Promise<SyncResponse> {
    const raw = await this.post('/v1/chat/messages/sync', {
      conversations: conversations.map((c) => ({
        conversation_id: c.conversationId,
        last_seq: c.lastSeq,
      })),
    });
    return {
      batches: (raw.batches ?? []).map((b: any) => ({
        conversationId: b.conversation_id,
        messages: (b.messages ?? []).map(transformMessage),
        currentSeq: b.current_seq ?? 0,
      })),
    };
  }

  /** Toggle reaction on a message. POST /v1/chat/messages/:id/reactions */
  async toggleReaction(messageId: string, conversationId: string, emoji: string): Promise<ToggleReactionResponse> {
    const raw = await this.post(`/v1/chat/messages/${messageId}/reactions`, {
      conversation_id: conversationId,
      emoji,
    });
    return { action: raw.action };
  }

  /** Forward a message to other conversations. POST /v1/chat/messages/forward */
  async forward(messageId: string, conversationIds: string[]): Promise<ForwardResponse> {
    const raw = await this.post('/v1/chat/messages/forward', {
      message_id: messageId,
      conversation_ids: conversationIds,
    });
    return {
      forwarded: (raw.forwarded ?? []).map(transformMessage),
    };
  }

  // --------------------------------------------------------------------------
  // Conversations
  // --------------------------------------------------------------------------

  /** List all conversations. GET /v1/chat/conversations */
  async listConversations(): Promise<Conversation[]> {
    const raw = await this.get('/v1/chat/conversations');
    return (raw.conversations ?? []).map(transformConversation);
  }

  /** Create a conversation. POST /v1/chat/conversations */
  async createConversation(params: CreateConversationParams): Promise<CreateConversationResponse> {
    const raw = await this.post('/v1/chat/conversations', {
      type: params.type,
      name: params.name,
      participant_ids: params.participantIds,
    });
    return {
      id: raw.id,
      type: raw.type as ConversationType,
      name: raw.name,
      createdBy: raw.created_by,
    };
  }

  /** Update a conversation. PATCH /v1/chat/conversations/:id */
  async updateConversation(conversationId: string, params: UpdateConversationParams): Promise<void> {
    await this.patch(`/v1/chat/conversations/${conversationId}`, {
      name: params.name,
      description: params.description,
    });
  }

  /** Mark conversation as read up to a sequence number. POST /v1/chat/conversations/:id/read */
  async markRead(conversationId: string, upToSeq: number): Promise<void> {
    await this.post(`/v1/chat/conversations/${conversationId}/read`, {
      up_to_seq: upToSeq,
    });
  }

  /** Delete a conversation. DELETE /v1/chat/conversations/:id */
  async deleteConversation(conversationId: string, mode: DeleteMode): Promise<void> {
    await this.delete(`/v1/chat/conversations/${conversationId}`, { mode });
  }

  /** Add participants to a conversation. POST /v1/chat/conversations/:id/participants */
  async addParticipants(conversationId: string, userIds: string[]): Promise<void> {
    await this.post(`/v1/chat/conversations/${conversationId}/participants`, {
      user_ids: userIds,
    });
  }

  /** Remove a participant. DELETE /v1/chat/conversations/:id/participants/:userId */
  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await this.delete(`/v1/chat/conversations/${conversationId}/participants/${userId}`);
  }

  /** Get participants. GET /v1/chat/conversations/:id/participants */
  async getParticipants(conversationId: string): Promise<Participant[]> {
    const raw = await this.get(`/v1/chat/conversations/${conversationId}/participants`);
    return (raw.participants ?? []).map(transformParticipant);
  }

  // --------------------------------------------------------------------------
  // Users & Agents
  // --------------------------------------------------------------------------

  /** List users. GET /v1/chat/users */
  async listUsers(): Promise<User[]> {
    const raw = await this.get('/v1/chat/users');
    return (raw.users ?? []).map(transformUser);
  }

  /** List agents. GET /v1/chat/agents */
  async listAgents(): Promise<Agent[]> {
    const raw = await this.get('/v1/chat/agents');
    return (raw.agents ?? []).map(transformUser);
  }

  // --------------------------------------------------------------------------
  // Edits, typing, unread, search (Bundle A)
  // --------------------------------------------------------------------------

  /** Edit a message you previously sent. PATCH /v1/chat/messages/:id */
  async editMessage(messageId: string, params: EditMessageParams): Promise<EditMessageResponse> {
    const raw = await this.patch(`/v1/chat/messages/${messageId}`, {
      content_text: params.contentText,
      content_meta: params.contentMeta,
    });
    return {
      messageId: raw.message_id,
      contentText: raw.content_text,
      editCount: raw.edit_count ?? 0,
      editedAt: raw.edited_at ?? '',
    };
  }

  /** Broadcast a typing indicator to a conversation. POST /v1/chat/conversations/:id/typing */
  async typing(conversationId: string, state: TypingState): Promise<void> {
    await this.post(`/v1/chat/conversations/${conversationId}/typing`, { state });
  }

  /** Get unread counts for every conversation the user participates in. */
  async getUnreadCounts(): Promise<UnreadCountsResponse> {
    const raw = await this.get('/v1/chat/conversations/unread');
    return {
      conversations: (raw.conversations ?? []).map((c: any) => ({
        conversationId: c.conversation_id,
        unreadCount: c.unread_count ?? 0,
        lastReadSeq: c.last_read_seq ?? 0,
      })),
      total: raw.total ?? 0,
    };
  }

  /** Full-text search over messages (ClickHouse-backed). */
  async searchMessages(params: SearchMessagesParams): Promise<SearchMessagesResponse> {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.conversationId) qs.set('conversation_id', params.conversationId);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.beforeSeq != null) qs.set('before_seq', String(params.beforeSeq));
    const raw = await this.get(`/v1/chat/messages/search?${qs.toString()}`);
    return {
      results: (raw.results ?? []).map((r: any): SearchResult => ({
        message: transformMessage(r.message),
        snippet: r.snippet ?? '',
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Mute, archive, block (Bundle B)
  // --------------------------------------------------------------------------

  /** Mute a conversation for the current user. */
  async mute(conversationId: string, params?: MuteParams): Promise<MuteResponse> {
    const body: Record<string, unknown> = {};
    if (params?.until) body.until = params.until;
    if (params?.durationSec != null) body.duration_sec = params.durationSec;
    const raw = await this.post(`/v1/chat/conversations/${conversationId}/mute`, body);
    return {
      conversationId: raw.conversation_id,
      mutedUntil: raw.muted_until,
    };
  }

  /** Unmute a conversation. */
  async unmute(conversationId: string): Promise<void> {
    await this.delete(`/v1/chat/conversations/${conversationId}/mute`);
  }

  /** Archive a conversation for the current user. */
  async archive(conversationId: string): Promise<ArchiveResponse> {
    const raw = await this.post(`/v1/chat/conversations/${conversationId}/archive`);
    return {
      conversationId: raw.conversation_id,
      archivedAt: raw.archived_at,
    };
  }

  /** Unarchive a conversation. */
  async unarchive(conversationId: string): Promise<void> {
    await this.delete(`/v1/chat/conversations/${conversationId}/archive`);
  }

  /** Soft-block a user. Blocked users' messages are hidden from the caller's views. */
  async blockUser(userId: string): Promise<void> {
    await this.post(`/v1/chat/users/${userId}/block`);
  }

  /** Unblock a user. */
  async unblockUser(userId: string): Promise<void> {
    await this.delete(`/v1/chat/users/${userId}/block`);
  }

  /** List users the caller has blocked. */
  async listBlocked(): Promise<ListBlockedResponse> {
    const raw = await this.get('/v1/chat/blocks');
    return {
      blocked: (raw.blocked ?? []).map((b: any) => ({
        userId: b.user_id,
        createdAt: b.created_at,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Messaging Token
  // --------------------------------------------------------------------------

  /** Get a WebSocket auth token. GET /v1/messaging/token */
  async getMessagingToken(): Promise<MessagingTokenResponse> {
    const raw = await this.get('/v1/messaging/token');
    return {
      token: raw.token,
      wsUrl: raw.ws_url,
      expiresAt: raw.expires_at,
    };
  }

  // --------------------------------------------------------------------------
  // HTTP helpers
  // --------------------------------------------------------------------------

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: await this.headers(),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text().catch(() => undefined);
      }
      const msg =
        (errorBody && typeof errorBody === 'object' && 'error' in errorBody
          ? (errorBody as any).error
          : undefined) ?? `HTTP ${res.status}`;
      throw new ChatApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status, errorBody);
    }

    // Some endpoints return empty 200 (mark read, delete, etc.)
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text);
  }

  private get(path: string) {
    return this.request('GET', path);
  }

  private post(path: string, body?: unknown) {
    return this.request('POST', path, body);
  }

  private patch(path: string, body?: unknown) {
    return this.request('PATCH', path, body);
  }

  private delete(path: string, body?: unknown) {
    return this.request('DELETE', path, body);
  }
}

// ============================================================================
// Transform helpers (snake_case server responses -> camelCase SDK types)
// ============================================================================

function transformMessage(raw: any): Message {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    seqNum: raw.seq_num ?? 0,
    senderId: raw.sender_id,
    senderType: raw.sender_type as SenderType,
    contentType: raw.content_type as ContentType,
    contentText: raw.content_text,
    contentMeta: raw.content_meta,
    replyToId: raw.reply_to_id,
    threadId: raw.thread_id,
    threadRole: (raw.thread_role ?? 'main') as ThreadRole,
    taskId: raw.task_id,
    createdAt: raw.created_at ?? '',
    isInternal: raw.is_internal,
    isForwarded: raw.is_forwarded,
    reactions: raw.reactions?.map(transformReactionGroup),
    editCount: raw.edit_count ?? undefined,
    editedAt: raw.edited_at ?? undefined,
  };
}

function transformReactionGroup(raw: any): ReactionGroup {
  return {
    emoji: raw.emoji,
    count: raw.count,
    userIds: raw.user_ids ?? [],
  };
}

function transformConversation(raw: any): Conversation {
  const conv: Conversation = {
    id: raw.id,
    type: raw.type as ConversationType,
    name: raw.name,
    description: raw.description,
    createdBy: raw.created_by ?? '',
    lastActivity: raw.last_activity,
    seqCounter: raw.seq_counter ?? 0,
    createdAt: raw.created_at ?? '',
    lastMessagePreview: raw.last_message_preview,
    unreadCount: raw.unread_count ?? 0,
    mutedUntil: raw.muted_until ?? null,
    archivedAt: raw.archived_at ?? null,
  };

  if (raw.contact) {
    conv.contact = {
      userId: raw.contact.user_id,
      displayName: raw.contact.display_name,
      isAgent: raw.contact.is_agent ?? false,
      status: raw.contact.status ?? '',
      avatarUrl: raw.contact.avatar_url,
      bio: raw.contact.bio,
      lastSeen: raw.contact.last_seen,
      jobRole: raw.contact.job_role,
      isDefaultAgent: raw.contact.is_default_agent,
      language: raw.contact.language,
    };
  }

  return conv;
}

function transformParticipant(raw: any): Participant {
  return {
    userId: raw.user_id,
    displayName: raw.display_name,
    isAgent: raw.is_agent ?? false,
    role: raw.role,
    avatarUrl: raw.avatar_url,
    status: raw.status,
    jobTitle: raw.job_title,
  };
}

function transformUser(raw: any): User {
  return {
    id: raw.id,
    displayName: raw.display_name,
    isAgent: raw.is_agent ?? false,
    status: raw.status ?? '',
    bio: raw.bio,
    avatarUrl: raw.avatar_url,
    lastSeen: raw.last_seen,
    jobTitle: raw.job_title,
    language: raw.language,
    isDefaultAgent: raw.is_default_agent,
  };
}
