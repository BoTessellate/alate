/**
 * Board State Persistence for Mood Layer SDK
 *
 * Provides autosave, restore, and versioning for moodboards:
 * - Automatic state snapshots
 * - Version history with undo/redo support
 * - State restoration after refresh
 * - Cross-device sync via Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createModuleLogger, logDbOperation } from './logger';
import { DatabaseError, NotFoundError, ConflictError, ValidationError } from './errors';
import { z } from 'zod';

const logger = createModuleLogger('boardState');

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export const boardElementSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'text', 'shape', 'label']),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number().default(0),
    zIndex: z.number().default(0),
  }),
  content: z.object({
    imageUrl: z.string().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional(),
  metadata: z.object({
    productId: z.string().optional(),
    brand: z.string().optional(),
    price: z.string().optional(),
    sourceUrl: z.string().optional(),
  }).optional(),
});

export type BoardElement = z.infer<typeof boardElementSchema>;

export const boardStateSchema = z.object({
  elements: z.array(boardElementSchema),
  canvas: z.object({
    width: z.number(),
    height: z.number(),
    backgroundColor: z.string().default('#ffffff'),
  }),
  theme: z.object({
    colors: z.record(z.string()).optional(),
    typography: z.object({
      fontFamily: z.string().optional(),
      headingSize: z.number().optional(),
      bodySize: z.number().optional(),
    }).optional(),
  }).optional(),
  selectedIds: z.array(z.string()).default([]),
});

export type BoardState = z.infer<typeof boardStateSchema>;

export interface BoardVersion {
  id: string;
  boardId: string;
  version: number;
  state: BoardState;
  createdAt: string;
  createdBy?: string;
  changeDescription?: string;
}

export interface Board {
  id: string;
  userId: string;
  name: string;
  description?: string;
  currentVersion: number;
  state: BoardState;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export interface BoardStateConfig {
  supabaseUrl: string;
  supabaseKey: string;
  boardsTable?: string;
  versionsTable?: string;
  maxVersions?: number;
  autoSaveInterval?: number;
}

// ============================================================================
// BOARD STATE MANAGER
// ============================================================================

export class BoardStateManager {
  private supabase: SupabaseClient;
  private boardsTable: string;
  private versionsTable: string;
  private maxVersions: number;
  private autoSaveInterval: number;
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingChanges: Map<string, BoardState> = new Map();

  constructor(config: BoardStateConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.boardsTable = config.boardsTable || 'boards';
    this.versionsTable = config.versionsTable || 'board_versions';
    this.maxVersions = config.maxVersions || 50;
    this.autoSaveInterval = config.autoSaveInterval || 5000;

    logger.info(
      {
        boardsTable: this.boardsTable,
        maxVersions: this.maxVersions,
        autoSaveInterval: this.autoSaveInterval,
      },
      'Board state manager initialized'
    );
  }

  // ==========================================================================
  // BOARD CRUD
  // ==========================================================================

  /**
   * Create a new board
   */
  async createBoard(
    userId: string,
    name: string,
    initialState?: Partial<BoardState>,
    options?: { description?: string; isPublic?: boolean }
  ): Promise<Board> {
    const startTime = Date.now();

    const state: BoardState = {
      elements: initialState?.elements || [],
      canvas: initialState?.canvas || { width: 1080, height: 1080, backgroundColor: '#ffffff' },
      theme: initialState?.theme,
      selectedIds: [],
    };

    const board = {
      user_id: userId,
      name,
      description: options?.description,
      current_version: 1,
      state,
      is_public: options?.isPublic || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.boardsTable)
      .insert(board)
      .select()
      .single();

    if (error) {
      logDbOperation(logger, 'INSERT', this.boardsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to create board: ${error.message}`, 'INSERT');
    }

    // Create initial version
    await this.createVersion(data.id, state, 'Initial version');

    logDbOperation(logger, 'INSERT', this.boardsTable, startTime, true, 1);
    logger.info({ boardId: data.id, userId }, 'Board created');

    return this.mapBoardFromDb(data);
  }

  /**
   * Get a board by ID
   */
  async getBoard(boardId: string, userId?: string): Promise<Board | null> {
    const startTime = Date.now();

    let query = this.supabase
      .from(this.boardsTable)
      .select()
      .eq('id', boardId);

    // If userId provided, check ownership or public
    if (userId) {
      query = query.or(`user_id.eq.${userId},is_public.eq.true`);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logDbOperation(logger, 'SELECT', this.boardsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to get board: ${error.message}`, 'SELECT');
    }

    // Update last accessed
    await this.supabase
      .from(this.boardsTable)
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', boardId);

    logDbOperation(logger, 'SELECT', this.boardsTable, startTime, true, 1);
    return this.mapBoardFromDb(data);
  }

  /**
   * Get all boards for a user
   */
  async getUserBoards(userId: string, limit = 50): Promise<Board[]> {
    const startTime = Date.now();

    const { data, error } = await this.supabase
      .from(this.boardsTable)
      .select()
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      logDbOperation(logger, 'SELECT', this.boardsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to get user boards: ${error.message}`, 'SELECT');
    }

    logDbOperation(logger, 'SELECT', this.boardsTable, startTime, true, data?.length);
    return data.map(this.mapBoardFromDb);
  }

  /**
   * Delete a board
   */
  async deleteBoard(boardId: string, userId: string): Promise<boolean> {
    const startTime = Date.now();

    // Delete versions first
    await this.supabase
      .from(this.versionsTable)
      .delete()
      .eq('board_id', boardId);

    const { error } = await this.supabase
      .from(this.boardsTable)
      .delete()
      .eq('id', boardId)
      .eq('user_id', userId);

    if (error) {
      logDbOperation(logger, 'DELETE', this.boardsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to delete board: ${error.message}`, 'DELETE');
    }

    // Cancel any pending autosave
    this.cancelAutoSave(boardId);

    logDbOperation(logger, 'DELETE', this.boardsTable, startTime, true, 1);
    logger.info({ boardId }, 'Board deleted');
    return true;
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Save board state (creates new version)
   */
  async saveState(
    boardId: string,
    state: BoardState,
    options?: { userId?: string; changeDescription?: string; force?: boolean }
  ): Promise<Board> {
    const startTime = Date.now();

    // Validate state
    try {
      boardStateSchema.parse(state);
    } catch (e: any) {
      throw new ValidationError(`Invalid board state: ${e.message}`);
    }

    // Get current board
    const currentBoard = await this.getBoard(boardId);
    if (!currentBoard) {
      throw new NotFoundError('Board', boardId);
    }

    // Check for conflicts (optimistic locking)
    if (!options?.force) {
      const { data: freshBoard } = await this.supabase
        .from(this.boardsTable)
        .select('current_version')
        .eq('id', boardId)
        .single();

      if (freshBoard && freshBoard.current_version !== currentBoard.currentVersion) {
        throw new ConflictError(
          'Board has been modified by another session. Refresh to get latest changes.'
        );
      }
    }

    const newVersion = currentBoard.currentVersion + 1;

    // Update board state
    const { data, error } = await this.supabase
      .from(this.boardsTable)
      .update({
        state,
        current_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', boardId)
      .select()
      .single();

    if (error) {
      logDbOperation(logger, 'UPDATE', this.boardsTable, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to save state: ${error.message}`, 'UPDATE');
    }

    // Create version history entry
    await this.createVersion(boardId, state, options?.changeDescription, options?.userId);

    // Cleanup old versions
    await this.pruneVersions(boardId);

    logDbOperation(logger, 'UPDATE', this.boardsTable, startTime, true, 1);
    logger.info({ boardId, version: newVersion }, 'Board state saved');

    return this.mapBoardFromDb(data);
  }

  /**
   * Schedule autosave for a board
   */
  scheduleAutoSave(boardId: string, state: BoardState): void {
    // Store pending changes
    this.pendingChanges.set(boardId, state);

    // Clear existing timer
    const existingTimer = this.autoSaveTimers.get(boardId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new save
    const timer = setTimeout(async () => {
      const pendingState = this.pendingChanges.get(boardId);
      if (pendingState) {
        try {
          await this.saveState(boardId, pendingState, {
            changeDescription: 'Autosave',
            force: true,
          });
          this.pendingChanges.delete(boardId);
        } catch (error: any) {
          logger.error({ boardId, error: error.message }, 'Autosave failed');
        }
      }
      this.autoSaveTimers.delete(boardId);
    }, this.autoSaveInterval);

    this.autoSaveTimers.set(boardId, timer);
  }

  /**
   * Cancel pending autosave
   */
  cancelAutoSave(boardId: string): void {
    const timer = this.autoSaveTimers.get(boardId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(boardId);
    }
    this.pendingChanges.delete(boardId);
  }

  /**
   * Flush all pending autosaves
   */
  async flushAutoSaves(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [boardId, state] of this.pendingChanges) {
      promises.push(
        this.saveState(boardId, state, { changeDescription: 'Autosave', force: true })
          .then(() => {
            this.cancelAutoSave(boardId);
          })
          .catch((error) => {
            logger.error({ boardId, error: error.message }, 'Failed to flush autosave');
          })
      );
    }

    await Promise.all(promises);
  }

  // ==========================================================================
  // VERSION HISTORY
  // ==========================================================================

  /**
   * Get version history for a board
   */
  async getVersionHistory(boardId: string, limit = 20): Promise<BoardVersion[]> {
    const { data, error } = await this.supabase
      .from(this.versionsTable)
      .select()
      .eq('board_id', boardId)
      .order('version', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(`Failed to get version history: ${error.message}`, 'SELECT');
    }

    return data.map(this.mapVersionFromDb);
  }

  /**
   * Get a specific version
   */
  async getVersion(boardId: string, version: number): Promise<BoardVersion | null> {
    const { data, error } = await this.supabase
      .from(this.versionsTable)
      .select()
      .eq('board_id', boardId)
      .eq('version', version)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to get version: ${error.message}`, 'SELECT');
    }

    return this.mapVersionFromDb(data);
  }

  /**
   * Restore board to a specific version
   */
  async restoreVersion(boardId: string, version: number, userId?: string): Promise<Board> {
    const targetVersion = await this.getVersion(boardId, version);
    if (!targetVersion) {
      throw new NotFoundError('Board version', `${boardId}:${version}`);
    }

    return this.saveState(boardId, targetVersion.state, {
      userId,
      changeDescription: `Restored from version ${version}`,
      force: true,
    });
  }

  /**
   * Create a version entry
   */
  private async createVersion(
    boardId: string,
    state: BoardState,
    description?: string,
    createdBy?: string
  ): Promise<void> {
    // Get current max version
    const { data: maxVersion } = await this.supabase
      .from(this.versionsTable)
      .select('version')
      .eq('board_id', boardId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const version = (maxVersion?.version || 0) + 1;

    await this.supabase.from(this.versionsTable).insert({
      board_id: boardId,
      version,
      state,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      change_description: description,
    });
  }

  /**
   * Remove old versions beyond the max limit
   */
  private async pruneVersions(boardId: string): Promise<void> {
    const { data: versions } = await this.supabase
      .from(this.versionsTable)
      .select('id, version')
      .eq('board_id', boardId)
      .order('version', { ascending: false });

    if (versions && versions.length > this.maxVersions) {
      const toDelete = versions.slice(this.maxVersions).map((v) => v.id);

      await this.supabase
        .from(this.versionsTable)
        .delete()
        .in('id', toDelete);

      logger.debug({ boardId, deleted: toDelete.length }, 'Pruned old versions');
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Duplicate a board
   */
  async duplicateBoard(boardId: string, userId: string, newName?: string): Promise<Board> {
    const sourceBoard = await this.getBoard(boardId);
    if (!sourceBoard) {
      throw new NotFoundError('Board', boardId);
    }

    return this.createBoard(
      userId,
      newName || `${sourceBoard.name} (Copy)`,
      sourceBoard.state,
      { description: `Duplicated from ${sourceBoard.name}` }
    );
  }

  /**
   * Map database row to Board type
   */
  private mapBoardFromDb(row: any): Board {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      currentVersion: row.current_version,
      state: row.state,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
    };
  }

  /**
   * Map database row to BoardVersion type
   */
  private mapVersionFromDb(row: any): BoardVersion {
    return {
      id: row.id,
      boardId: row.board_id,
      version: row.version,
      state: row.state,
      createdAt: row.created_at,
      createdBy: row.created_by,
      changeDescription: row.change_description,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a board state manager with environment variables
 */
export function createBoardStateManager(config?: Partial<BoardStateConfig>): BoardStateManager {
  return new BoardStateManager({
    supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL || '',
    supabaseKey: config?.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
    boardsTable: config?.boardsTable,
    versionsTable: config?.versionsTable,
    maxVersions: config?.maxVersions,
    autoSaveInterval: config?.autoSaveInterval,
  });
}
