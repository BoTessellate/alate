/**
 * Background Job Queue for Mood Layer SDK
 *
 * Provides async job processing for long-running tasks:
 * - Batch product enrichment
 * - Image processing
 * - Export generation
 * - Plugin sync operations
 *
 * Uses an in-memory queue with Supabase persistence for
 * job status tracking (suitable for serverless environments).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createModuleLogger, logDbOperation } from './logger';
import { DatabaseError, TimeoutError, ValidationError } from './errors';

const logger = createModuleLogger('jobQueue');

// ============================================================================
// TYPES
// ============================================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface JobData {
  [key: string]: unknown;
}

export interface Job<T extends JobData = JobData> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface JobHandler<T extends JobData = JobData, R = unknown> {
  (job: Job<T>): Promise<R>;
}

export interface QueueConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  maxConcurrency?: number;
  defaultMaxAttempts?: number;
  pollInterval?: number;
  jobTimeout?: number;
}

export interface EnqueueOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  scheduledFor?: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// JOB QUEUE CLASS
// ============================================================================

export class JobQueue {
  private supabase: SupabaseClient;
  private tableName: string;
  private handlers: Map<string, JobHandler<any, any>> = new Map();
  private maxConcurrency: number;
  private defaultMaxAttempts: number;
  private pollInterval: number;
  private jobTimeout: number;
  private isProcessing = false;
  private activeJobs = 0;

  constructor(config: QueueConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.tableName = config.tableName || 'job_queue';
    this.maxConcurrency = config.maxConcurrency || 5;
    this.defaultMaxAttempts = config.defaultMaxAttempts || 3;
    this.pollInterval = config.pollInterval || 5000;
    this.jobTimeout = config.jobTimeout || 300000; // 5 minutes

    logger.info(
      {
        tableName: this.tableName,
        maxConcurrency: this.maxConcurrency,
        pollInterval: this.pollInterval,
      },
      'Job queue initialized'
    );
  }

  /**
   * Register a handler for a job type
   */
  registerHandler<T extends JobData, R>(type: string, handler: JobHandler<T, R>): void {
    if (this.handlers.has(type)) {
      logger.warn({ type }, 'Overwriting existing job handler');
    }
    this.handlers.set(type, handler);
    logger.info({ type }, 'Job handler registered');
  }

  /**
   * Add a new job to the queue
   */
  async enqueue<T extends JobData>(
    type: string,
    data: T,
    options: EnqueueOptions = {}
  ): Promise<Job<T>> {
    const startTime = Date.now();

    const job: Omit<Job<T>, 'id'> = {
      type,
      data,
      status: 'pending',
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || this.defaultMaxAttempts,
      createdAt: new Date().toISOString(),
      scheduledFor: options.scheduledFor?.toISOString(),
      userId: options.userId,
      metadata: options.metadata,
    };

    const dbRecord = toDbRecord(job);

    const { data: insertedJob, error } = await this.supabase
      .from(this.tableName)
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      logDbOperation(logger, 'INSERT', this.tableName, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to enqueue job: ${error.message}`, 'INSERT');
    }

    logDbOperation(logger, 'INSERT', this.tableName, startTime, true, 1);
    logger.info({ jobId: insertedJob.id, type, priority: job.priority }, 'Job enqueued');

    return fromDbRecord<T>(insertedJob);
  }

  /**
   * Add multiple jobs to the queue
   */
  async enqueueBatch<T extends JobData>(
    type: string,
    dataItems: T[],
    options: EnqueueOptions = {}
  ): Promise<Job<T>[]> {
    const startTime = Date.now();

    const jobs = dataItems.map((data) => {
      const job: Omit<Job<T>, 'id'> = {
        type,
        data,
        status: 'pending',
        priority: options.priority || 'normal',
        attempts: 0,
        maxAttempts: options.maxAttempts || this.defaultMaxAttempts,
        createdAt: new Date().toISOString(),
        scheduledFor: options.scheduledFor?.toISOString(),
        userId: options.userId,
        metadata: options.metadata,
      };
      return toDbRecord(job);
    });

    const { data: insertedJobs, error } = await this.supabase
      .from(this.tableName)
      .insert(jobs)
      .select();

    if (error) {
      logDbOperation(logger, 'INSERT', this.tableName, startTime, false, undefined, error as any);
      throw new DatabaseError(`Failed to enqueue batch: ${error.message}`, 'INSERT');
    }

    logDbOperation(logger, 'INSERT', this.tableName, startTime, true, insertedJobs?.length);
    logger.info({ count: insertedJobs?.length, type }, 'Batch jobs enqueued');

    return (insertedJobs || []).map((record) => fromDbRecord<T>(record));
  }

  /**
   * Get a job by ID
   */
  async getJob<T extends JobData>(jobId: string): Promise<Job<T> | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to get job: ${error.message}`, 'SELECT');
    }

    return fromDbRecord<T>(data);
  }

  /**
   * Get jobs by user ID
   */
  async getJobsByUser(userId: string, limit = 50): Promise<Job[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(`Failed to get user jobs: ${error.message}`, 'SELECT');
    }

    return (data || []).map((record) => fromDbRecord(record));
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw new DatabaseError(`Failed to cancel job: ${error.message}`, 'UPDATE');
    }

    logger.info({ jobId }, 'Job cancelled');
    return true;
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.error({ jobId: job.id, type: job.type }, 'No handler registered for job type');
      await this.failJob(job.id, 'No handler registered for job type');
      return;
    }

    const startTime = Date.now();
    logger.info({ jobId: job.id, type: job.type, attempt: job.attempts + 1 }, 'Processing job');

    try {
      // Update job to processing
      await this.supabase
        .from(this.tableName)
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq('id', job.id);

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError('Job execution', this.jobTimeout));
        }, this.jobTimeout);
      });

      // Execute handler with timeout
      const result = await Promise.race([handler(job), timeoutPromise]);

      // Mark as completed
      await this.supabase
        .from(this.tableName)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result,
        })
        .eq('id', job.id);

      logger.info(
        {
          jobId: job.id,
          type: job.type,
          duration: `${Date.now() - startTime}ms`,
        },
        'Job completed successfully'
      );
    } catch (error: any) {
      const attempts = job.attempts + 1;
      const shouldRetry = attempts < job.maxAttempts;

      if (shouldRetry) {
        await this.supabase
          .from(this.tableName)
          .update({
            status: 'pending',
            error: error.message,
            attempts,
          })
          .eq('id', job.id);

        logger.warn(
          {
            jobId: job.id,
            type: job.type,
            attempt: attempts,
            maxAttempts: job.maxAttempts,
            error: error.message,
          },
          'Job failed, will retry'
        );
      } else {
        await this.failJob(job.id, error.message);
        logger.error(
          {
            jobId: job.id,
            type: job.type,
            error: error.message,
          },
          'Job failed permanently'
        );
      }
    }
  }

  /**
   * Mark a job as failed
   */
  private async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from(this.tableName)
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: errorMessage,
      })
      .eq('id', jobId);
  }

  /**
   * Fetch next batch of pending jobs
   * Orders by priority_order (numeric: critical=4, high=3, normal=2, low=1)
   * then by created_at (oldest first)
   *
   * Falls back to created_at only if priority_order column doesn't exist
   */
  private async fetchPendingJobs(limit: number): Promise<Job[]> {
    const now = new Date().toISOString();

    // Try with priority_order first (numeric ordering)
    let { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq('status', 'pending')
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
      .order('priority_order', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    // Fallback to created_at only if priority_order column doesn't exist
    if (error?.message?.includes('priority_order')) {
      logger.warn('priority_order column not found, falling back to created_at ordering');
      const result = await this.supabase
        .from(this.tableName)
        .select()
        .eq('status', 'pending')
        .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
        .order('created_at', { ascending: true })
        .limit(limit);

      data = result.data;
      error = result.error;
    }

    if (error) {
      logger.error({ error: error.message }, 'Failed to fetch pending jobs');
      return [];
    }

    return (data || []).map((record) => fromDbRecord(record));
  }

  /**
   * Start processing jobs (polling mode)
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Job queue is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Job queue started');

    while (this.isProcessing) {
      const availableSlots = this.maxConcurrency - this.activeJobs;

      if (availableSlots > 0) {
        const jobs = await this.fetchPendingJobs(availableSlots);

        for (const job of jobs) {
          this.activeJobs++;
          this.processJob(job).finally(() => {
            this.activeJobs--;
          });
        }
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.isProcessing = false;
    logger.info('Job queue stopped');
  }

  /**
   * Process a single batch of jobs (for serverless)
   * Use this in Vercel/Lambda instead of start()
   */
  async processBatch(limit?: number): Promise<number> {
    const batchSize = limit || this.maxConcurrency;
    const jobs = await this.fetchPendingJobs(batchSize);

    if (jobs.length === 0) {
      logger.debug('No pending jobs to process');
      return 0;
    }

    logger.info({ count: jobs.length }, 'Processing job batch');

    await Promise.all(jobs.map((job) => this.processJob(job)));

    return jobs.length;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const { data, error } = await this.supabase.rpc('get_job_queue_stats', {
      table_name: this.tableName,
    });

    if (error) {
      // Fallback to manual count if RPC doesn't exist
      const results = await Promise.all([
        this.supabase.from(this.tableName).select('id', { count: 'exact' }).eq('status', 'pending'),
        this.supabase.from(this.tableName).select('id', { count: 'exact' }).eq('status', 'processing'),
        this.supabase.from(this.tableName).select('id', { count: 'exact' }).eq('status', 'completed'),
        this.supabase.from(this.tableName).select('id', { count: 'exact' }).eq('status', 'failed'),
        this.supabase.from(this.tableName).select('id', { count: 'exact' }).eq('status', 'cancelled'),
      ]);

      return {
        pending: results[0].count || 0,
        processing: results[1].count || 0,
        completed: results[2].count || 0,
        failed: results[3].count || 0,
        cancelled: results[4].count || 0,
      };
    }

    return data;
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(olderThanDays = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const { count, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .in('status', ['completed', 'failed', 'cancelled'])
      .lt('completed_at', cutoff.toISOString());

    if (error) {
      throw new DatabaseError(`Failed to cleanup jobs: ${error.message}`, 'DELETE');
    }

    logger.info({ deletedCount: count, olderThanDays }, 'Old jobs cleaned up');
    return count || 0;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new job queue instance
 */
export function createJobQueue(config: QueueConfig): JobQueue {
  return new JobQueue(config);
}

// ============================================================================
// PRE-DEFINED JOB TYPES
// ============================================================================

/**
 * Job types for type-safe job creation
 */
export const JobTypes = {
  ENRICH_PRODUCT: 'enrich_product',
  ENRICH_BATCH: 'enrich_batch',
  PROCESS_IMAGE: 'process_image',
  PROCESS_CUTOUT: 'process_cutout',
  GENERATE_EXPORT: 'generate_export',
  SYNC_PRODUCTS: 'sync_products',
  EXTRACT_THEME: 'extract_theme',
  GENERATE_LAYOUT: 'generate_layout',
} as const;

// ============================================================================
// DATABASE MAPPING HELPERS
// ============================================================================

/**
 * Convert camelCase Job object to snake_case for database insert
 */
function toDbRecord(job: Omit<Job, 'id'>): Record<string, unknown> {
  return {
    type: job.type,
    data: job.data,
    status: job.status,
    priority: job.priority,
    attempts: job.attempts,
    max_attempts: job.maxAttempts,
    result: job.result,
    error: job.error,
    created_at: job.createdAt,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    scheduled_for: job.scheduledFor,
    user_id: job.userId,
    metadata: job.metadata,
  };
}

/**
 * Convert snake_case database record to camelCase Job object
 */
function fromDbRecord<T extends JobData>(record: Record<string, unknown>): Job<T> {
  return {
    id: record.id as string,
    type: record.type as string,
    data: record.data as T,
    status: record.status as JobStatus,
    priority: record.priority as JobPriority,
    attempts: record.attempts as number,
    maxAttempts: record.max_attempts as number,
    result: record.result,
    error: record.error as string | undefined,
    createdAt: record.created_at as string,
    startedAt: record.started_at as string | undefined,
    completedAt: record.completed_at as string | undefined,
    scheduledFor: record.scheduled_for as string | undefined,
    userId: record.user_id as string | undefined,
    metadata: record.metadata as Record<string, unknown> | undefined,
  };
}

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];

// ============================================================================
// JOB DATA INTERFACES
// ============================================================================

export interface EnrichProductJobData extends JobData {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  imageUrl?: string;
}

export interface EnrichBatchJobData extends JobData {
  products: Array<{
    productName: string;
    brand: string;
    category: string;
  }>;
}

export interface ProcessImageJobData extends JobData {
  imageUrl: string;
  operations: Array<'resize' | 'crop' | 'optimize' | 'extract_colors'>;
  outputFormat?: 'png' | 'jpg' | 'webp';
}

export interface GenerateExportJobData extends JobData {
  boardId: string;
  format: 'png' | 'jpg' | 'pdf';
  quality?: number;
  scale?: number;
}

export interface SyncProductsJobData extends JobData {
  platform: 'shopify' | 'woocommerce' | 'wix';
  storeId: string;
  productIds?: string[];
  fullSync?: boolean;
}

export interface ProcessCutoutJobData extends JobData {
  productId: string;
  imageUrl: string;
  userId?: string;
}
