/**
 * Sharing & Collaboration Layer for Mood Layer SDK
 *
 * Provides collaborative features for moodboards:
 * - Share boards via link
 * - Remix/fork public boards
 * - Trending and featured boards
 * - Comments and reactions
 * - Real-time collaboration (future)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createModuleLogger, logDbOperation } from './logger';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError } from './errors';

const logger = createModuleLogger('collaboration');

// ============================================================================
// TYPES
// ============================================================================

export type SharePermission = 'view' | 'comment' | 'edit' | 'admin';
export type ReactionType = 'like' | 'love' | 'inspire' | 'bookmark';

export interface ShareLink {
  id: string;
  boardId: string;
  createdBy: string;
  token: string;
  permission: SharePermission;
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
  password?: string;
  isActive: boolean;
  createdAt: string;
}

export interface BoardCollaborator {
  id: string;
  boardId: string;
  userId: string;
  permission: SharePermission;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  email?: string;
  name?: string;
}

export interface BoardComment {
  id: string;
  boardId: string;
  userId: string;
  parentId?: string;
  content: string;
  elementId?: string;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt?: string;
  isResolved?: boolean;
  userName?: string;
  userAvatar?: string;
}

export interface BoardReaction {
  id: string;
  boardId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface TrendingBoard {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  creatorName?: string;
  creatorAvatar?: string;
  viewCount: number;
  likeCount: number;
  remixCount: number;
  createdAt: string;
  tags?: string[];
}

export interface CollaborationConfig {
  supabaseUrl: string;
  supabaseKey: string;
  shareLinksTable?: string;
  collaboratorsTable?: string;
  commentsTable?: string;
  reactionsTable?: string;
  analyticsTable?: string;
  defaultLinkExpiry?: number;
}

// ============================================================================
// COLLABORATION SERVICE
// ============================================================================

export class CollaborationService {
  private supabase: SupabaseClient;
  private shareLinksTable: string;
  private collaboratorsTable: string;
  private commentsTable: string;
  private reactionsTable: string;
  private analyticsTable: string;
  private defaultLinkExpiry: number;

  constructor(config: CollaborationConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.shareLinksTable = config.shareLinksTable || 'board_share_links';
    this.collaboratorsTable = config.collaboratorsTable || 'board_collaborators';
    this.commentsTable = config.commentsTable || 'board_comments';
    this.reactionsTable = config.reactionsTable || 'board_reactions';
    this.analyticsTable = config.analyticsTable || 'board_analytics';
    this.defaultLinkExpiry = config.defaultLinkExpiry || 7 * 24 * 60 * 60 * 1000; // 7 days

    logger.info('Collaboration service initialized');
  }

  // ==========================================================================
  // SHARE LINKS
  // ==========================================================================

  /**
   * Create a shareable link for a board
   */
  async createShareLink(
    boardId: string,
    createdBy: string,
    options: {
      permission?: SharePermission;
      expiresIn?: number;
      maxUses?: number;
      password?: string;
    } = {}
  ): Promise<ShareLink> {
    const startTime = Date.now();

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = options.expiresIn
      ? new Date(Date.now() + options.expiresIn).toISOString()
      : options.expiresIn === 0
        ? undefined
        : new Date(Date.now() + this.defaultLinkExpiry).toISOString();

    const passwordHash = options.password
      ? crypto.createHash('sha256').update(options.password).digest('hex')
      : undefined;

    const record = {
      board_id: boardId,
      created_by: createdBy,
      token,
      permission: options.permission || 'view',
      expires_at: expiresAt,
      max_uses: options.maxUses,
      use_count: 0,
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.shareLinksTable)
      .insert(record)
      .select()
      .single();

    if (error) {
      logDbOperation(logger, 'INSERT', this.shareLinksTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to create share link: ${error.message}`, 'INSERT');
    }

    logDbOperation(logger, 'INSERT', this.shareLinksTable, startTime, true, 1);
    logger.info({ boardId, linkId: data.id }, 'Share link created');

    return this.mapShareLinkFromDb(data);
  }

  /**
   * Get share link by token
   */
  async getShareLink(token: string): Promise<ShareLink | null> {
    const { data, error } = await this.supabase
      .from(this.shareLinksTable)
      .select()
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapShareLinkFromDb(data);
  }

  /**
   * Validate and use share link
   */
  async useShareLink(
    token: string,
    password?: string
  ): Promise<{ boardId: string; permission: SharePermission }> {
    const link = await this.getShareLink(token);

    if (!link) {
      throw new NotFoundError('Share link', token);
    }

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      throw new ForbiddenError('Share link has expired');
    }

    // Check max uses
    if (link.maxUses && link.useCount >= link.maxUses) {
      throw new ForbiddenError('Share link has reached maximum uses');
    }

    // Check password
    if (link.password) {
      if (!password) {
        throw new ValidationError('Password required');
      }
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (passwordHash !== link.password) {
        throw new ForbiddenError('Invalid password');
      }
    }

    // Increment use count
    await this.supabase
      .from(this.shareLinksTable)
      .update({ use_count: link.useCount + 1 })
      .eq('id', link.id);

    return { boardId: link.boardId, permission: link.permission };
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(linkId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.shareLinksTable)
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('created_by', userId);

    if (error) {
      throw new DatabaseError(`Failed to revoke share link: ${error.message}`, 'UPDATE');
    }

    logger.info({ linkId }, 'Share link revoked');
  }

  /**
   * Get all share links for a board
   */
  async getBoardShareLinks(boardId: string): Promise<ShareLink[]> {
    const { data, error } = await this.supabase
      .from(this.shareLinksTable)
      .select()
      .eq('board_id', boardId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to get share links: ${error.message}`, 'SELECT');
    }

    return (data || []).map(this.mapShareLinkFromDb);
  }

  // ==========================================================================
  // COLLABORATORS
  // ==========================================================================

  /**
   * Invite collaborator to board
   */
  async inviteCollaborator(
    boardId: string,
    invitedBy: string,
    inviteeEmail: string,
    permission: SharePermission = 'edit'
  ): Promise<BoardCollaborator> {
    const startTime = Date.now();

    // Check if already invited
    const { data: existing } = await this.supabase
      .from(this.collaboratorsTable)
      .select()
      .eq('board_id', boardId)
      .eq('email', inviteeEmail)
      .single();

    if (existing) {
      throw new ValidationError('User is already a collaborator');
    }

    const record = {
      board_id: boardId,
      invited_by: invitedBy,
      email: inviteeEmail,
      permission,
      invited_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.collaboratorsTable)
      .insert(record)
      .select()
      .single();

    if (error) {
      logDbOperation(logger, 'INSERT', this.collaboratorsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to invite collaborator: ${error.message}`, 'INSERT');
    }

    logDbOperation(logger, 'INSERT', this.collaboratorsTable, startTime, true, 1);
    logger.info({ boardId, email: inviteeEmail }, 'Collaborator invited');

    return this.mapCollaboratorFromDb(data);
  }

  /**
   * Accept collaboration invite
   */
  async acceptInvite(boardId: string, userId: string, email: string): Promise<BoardCollaborator> {
    const { data, error } = await this.supabase
      .from(this.collaboratorsTable)
      .update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('board_id', boardId)
      .eq('email', email)
      .is('accepted_at', null)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Invitation', `${boardId}:${email}`);
    }

    logger.info({ boardId, userId }, 'Invite accepted');
    return this.mapCollaboratorFromDb(data);
  }

  /**
   * Remove collaborator
   */
  async removeCollaborator(boardId: string, collaboratorId: string, removedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.collaboratorsTable)
      .delete()
      .eq('id', collaboratorId)
      .eq('board_id', boardId);

    if (error) {
      throw new DatabaseError(`Failed to remove collaborator: ${error.message}`, 'DELETE');
    }

    logger.info({ boardId, collaboratorId, removedBy }, 'Collaborator removed');
  }

  /**
   * Get collaborators for a board
   */
  async getBoardCollaborators(boardId: string): Promise<BoardCollaborator[]> {
    const { data, error } = await this.supabase
      .from(this.collaboratorsTable)
      .select()
      .eq('board_id', boardId)
      .order('invited_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to get collaborators: ${error.message}`, 'SELECT');
    }

    return (data || []).map(this.mapCollaboratorFromDb);
  }

  /**
   * Check user permission on board
   */
  async getUserPermission(boardId: string, userId: string): Promise<SharePermission | null> {
    const { data } = await this.supabase
      .from(this.collaboratorsTable)
      .select('permission')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .single();

    return data?.permission || null;
  }

  // ==========================================================================
  // COMMENTS
  // ==========================================================================

  /**
   * Add comment to board
   */
  async addComment(
    boardId: string,
    userId: string,
    content: string,
    options: {
      parentId?: string;
      elementId?: string;
      position?: { x: number; y: number };
    } = {}
  ): Promise<BoardComment> {
    const record = {
      board_id: boardId,
      user_id: userId,
      content,
      parent_id: options.parentId,
      element_id: options.elementId,
      position: options.position,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.commentsTable)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to add comment: ${error.message}`, 'INSERT');
    }

    logger.info({ boardId, commentId: data.id }, 'Comment added');
    return this.mapCommentFromDb(data);
  }

  /**
   * Update comment
   */
  async updateComment(commentId: string, userId: string, content: string): Promise<BoardComment> {
    const { data, error } = await this.supabase
      .from(this.commentsTable)
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Comment', commentId);
    }

    return this.mapCommentFromDb(data);
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.commentsTable)
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      throw new DatabaseError(`Failed to delete comment: ${error.message}`, 'DELETE');
    }
  }

  /**
   * Get comments for board
   */
  async getBoardComments(boardId: string): Promise<BoardComment[]> {
    const { data, error } = await this.supabase
      .from(this.commentsTable)
      .select()
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to get comments: ${error.message}`, 'SELECT');
    }

    return (data || []).map(this.mapCommentFromDb);
  }

  /**
   * Resolve/unresolve comment
   */
  async resolveComment(commentId: string, isResolved: boolean): Promise<void> {
    await this.supabase
      .from(this.commentsTable)
      .update({ is_resolved: isResolved })
      .eq('id', commentId);
  }

  // ==========================================================================
  // REACTIONS
  // ==========================================================================

  /**
   * Add reaction to board
   */
  async addReaction(boardId: string, userId: string, type: ReactionType): Promise<BoardReaction> {
    const { data, error } = await this.supabase
      .from(this.reactionsTable)
      .upsert(
        {
          board_id: boardId,
          user_id: userId,
          type,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'board_id,user_id,type' }
      )
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to add reaction: ${error.message}`, 'UPSERT');
    }

    return this.mapReactionFromDb(data);
  }

  /**
   * Remove reaction from board
   */
  async removeReaction(boardId: string, userId: string, type: ReactionType): Promise<void> {
    await this.supabase
      .from(this.reactionsTable)
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .eq('type', type);
  }

  /**
   * Get reaction counts for board
   */
  async getReactionCounts(boardId: string): Promise<Record<ReactionType, number>> {
    const { data } = await this.supabase
      .from(this.reactionsTable)
      .select('type')
      .eq('board_id', boardId);

    const counts: Record<ReactionType, number> = {
      like: 0,
      love: 0,
      inspire: 0,
      bookmark: 0,
    };

    for (const row of data || []) {
      counts[row.type as ReactionType]++;
    }

    return counts;
  }

  /**
   * Get user reactions for board
   */
  async getUserReactions(boardId: string, userId: string): Promise<ReactionType[]> {
    const { data } = await this.supabase
      .from(this.reactionsTable)
      .select('type')
      .eq('board_id', boardId)
      .eq('user_id', userId);

    return (data || []).map((r) => r.type as ReactionType);
  }

  // ==========================================================================
  // REMIX / FORK
  // ==========================================================================

  /**
   * Remix (fork) a public board
   */
  async remixBoard(
    sourceBoardId: string,
    userId: string,
    newName?: string
  ): Promise<{ newBoardId: string }> {
    // Get source board
    const { data: sourceBoard, error: sourceError } = await this.supabase
      .from('boards')
      .select()
      .eq('id', sourceBoardId)
      .eq('is_public', true)
      .single();

    if (sourceError || !sourceBoard) {
      throw new NotFoundError('Board', sourceBoardId);
    }

    // Create new board
    const newBoard = {
      user_id: userId,
      name: newName || `${sourceBoard.name} (Remix)`,
      description: `Remixed from: ${sourceBoard.name}`,
      state: sourceBoard.state,
      is_public: false,
      remixed_from: sourceBoardId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createError } = await this.supabase
      .from('boards')
      .insert(newBoard)
      .select()
      .single();

    if (createError) {
      throw new DatabaseError(`Failed to remix board: ${createError.message}`, 'INSERT');
    }

    // Record remix in analytics
    await this.recordAnalytics(sourceBoardId, 'remix');

    logger.info({ sourceBoardId, newBoardId: created.id, userId }, 'Board remixed');
    return { newBoardId: created.id };
  }

  // ==========================================================================
  // TRENDING & DISCOVERY
  // ==========================================================================

  /**
   * Get trending boards
   */
  async getTrendingBoards(options: {
    limit?: number;
    period?: 'day' | 'week' | 'month' | 'all';
    category?: string;
  } = {}): Promise<TrendingBoard[]> {
    const { limit = 20, period = 'week' } = options;

    // Calculate date cutoff
    const cutoff = new Date();
    switch (period) {
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }

    const { data, error } = await this.supabase
      .from('boards')
      .select(`
        id,
        name,
        description,
        created_at,
        thumbnail_url,
        users (name, avatar_url),
        board_analytics (view_count, like_count, remix_count)
      `)
      .eq('is_public', true)
      .gte('created_at', period === 'all' ? '1970-01-01' : cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Get extra for scoring

    if (error) {
      throw new DatabaseError(`Failed to get trending boards: ${error.message}`, 'SELECT');
    }

    // Calculate trending score and sort
    const scored = (data || []).map((board: any) => {
      const analytics = board.board_analytics?.[0] || {};
      const score =
        (analytics.view_count || 0) * 1 +
        (analytics.like_count || 0) * 5 +
        (analytics.remix_count || 0) * 10;

      return {
        id: board.id,
        name: board.name,
        description: board.description,
        thumbnailUrl: board.thumbnail_url,
        creatorName: board.users?.name,
        creatorAvatar: board.users?.avatar_url,
        viewCount: analytics.view_count || 0,
        likeCount: analytics.like_count || 0,
        remixCount: analytics.remix_count || 0,
        createdAt: board.created_at,
        _score: score,
      };
    });

    return scored
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...board }) => board);
  }

  /**
   * Record analytics event
   */
  async recordAnalytics(boardId: string, eventType: 'view' | 'like' | 'remix'): Promise<void> {
    const column = `${eventType}_count`;

    await this.supabase.rpc('increment_board_analytics', {
      p_board_id: boardId,
      p_column: column,
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private mapShareLinkFromDb(row: any): ShareLink {
    return {
      id: row.id,
      boardId: row.board_id,
      createdBy: row.created_by,
      token: row.token,
      permission: row.permission,
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      useCount: row.use_count,
      password: row.password_hash ? '[PROTECTED]' : undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  private mapCollaboratorFromDb(row: any): BoardCollaborator {
    return {
      id: row.id,
      boardId: row.board_id,
      userId: row.user_id,
      permission: row.permission,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
      email: row.email,
      name: row.name,
    };
  }

  private mapCommentFromDb(row: any): BoardComment {
    return {
      id: row.id,
      boardId: row.board_id,
      userId: row.user_id,
      parentId: row.parent_id,
      content: row.content,
      elementId: row.element_id,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isResolved: row.is_resolved,
      userName: row.user_name,
      userAvatar: row.user_avatar,
    };
  }

  private mapReactionFromDb(row: any): BoardReaction {
    return {
      id: row.id,
      boardId: row.board_id,
      userId: row.user_id,
      type: row.type,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create collaboration service with environment variables
 */
export function createCollaborationService(
  config?: Partial<CollaborationConfig>
): CollaborationService {
  return new CollaborationService({
    supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL || '',
    supabaseKey: config?.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
    shareLinksTable: config?.shareLinksTable,
    collaboratorsTable: config?.collaboratorsTable,
    commentsTable: config?.commentsTable,
    reactionsTable: config?.reactionsTable,
    analyticsTable: config?.analyticsTable,
    defaultLinkExpiry: config?.defaultLinkExpiry,
  });
}
