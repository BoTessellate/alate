/**
 * Export to Shareable Link
 * Creates shareable links with download capability
 */

import { MoodboardComposition } from '../moodboardComposer/composeBoard';
import { exportBoardDraft } from '../moodboardComposer/exportBoardDraft';
import { createClient } from '@supabase/supabase-js';

export interface ExportLinkRequest {
  composition: MoodboardComposition;
  export_format?: 'png' | 'json';
  allow_download?: boolean;
  expires_in_days?: number;
  password_protected?: boolean;
  password?: string;
}

export interface ExportLinkResponse {
  success: boolean;
  link_id: string;
  share_url: string;
  download_url?: string;
  qr_code_url?: string;
  expires_at?: string;
  password_required: boolean;
  metadata: {
    composition_id: string;
    composition_name: string;
    export_format: string;
    file_size?: number;
  };
}

export interface LinkAccessRequest {
  link_id: string;
  password?: string;
}

export interface LinkAccessResponse {
  success: boolean;
  allowed: boolean;
  composition?: MoodboardComposition;
  download_url?: string;
  error?: string;
}

/**
 * Export Link Generator
 */
export class ExportLinkGenerator {
  private supabase;
  private baseUrl: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.baseUrl = process.env.MOOD_LAYER_URL || 'https://moodlayer.com';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create shareable export link
   */
  async createExportLink(request: ExportLinkRequest): Promise<ExportLinkResponse> {
    try {
      const {
        composition,
        export_format = 'png',
        allow_download = true,
        expires_in_days,
        password_protected = false,
        password
      } = request;

      // Generate unique link ID
      const linkId = this.generateLinkId();

      // Export composition
      const exportResult = await exportBoardDraft({
        composition,
        mode: export_format,
        quality: 90,
        upload_to_cdn: true
      });

      if (!exportResult.success) {
        throw new Error('Failed to export composition');
      }

      // Calculate expiration
      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      // Hash password if provided
      const passwordHash = password_protected && password
        ? await this.hashPassword(password)
        : undefined;

      // Create share URLs
      const shareUrl = `${this.baseUrl}/view/${linkId}`;
      const downloadUrl = allow_download
        ? `${this.baseUrl}/download/${linkId}`
        : undefined;

      // Save link record to database
      await this.saveLinkRecord({
        link_id: linkId,
        composition_id: composition.id,
        export_url: exportResult.url || exportResult.preview_url,
        export_format,
        allow_download,
        expires_at: expiresAt,
        password_hash: passwordHash,
        password_protected
      });

      return {
        success: true,
        link_id: linkId,
        share_url: shareUrl,
        download_url: downloadUrl,
        expires_at: expiresAt,
        password_required: password_protected,
        metadata: {
          composition_id: composition.id,
          composition_name: composition.name,
          export_format,
          file_size: exportResult.metadata.file_size
        }
      };
    } catch (error) {
      console.error('Create export link error:', error);
      throw error;
    }
  }

  /**
   * Access a shared link
   */
  async accessLink(request: LinkAccessRequest): Promise<LinkAccessResponse> {
    try {
      const { link_id, password } = request;

      // Get link record
      const { data: link, error } = await this.supabase
        .from('export_links')
        .select('*')
        .eq('link_id', link_id)
        .single();

      if (error || !link) {
        return {
          success: false,
          allowed: false,
          error: 'Link not found'
        };
      }

      // Check expiration
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return {
          success: false,
          allowed: false,
          error: 'Link has expired'
        };
      }

      // Check password
      if (link.password_protected) {
        if (!password) {
          return {
            success: false,
            allowed: false,
            error: 'Password required'
          };
        }

        const passwordValid = await this.verifyPassword(password, link.password_hash);
        if (!passwordValid) {
          return {
            success: false,
            allowed: false,
            error: 'Invalid password'
          };
        }
      }

      // Get composition
      const { data: composition } = await this.supabase
        .from('moodboard_compositions')
        .select('*')
        .eq('id', link.composition_id)
        .single();

      // Increment view count
      await this.incrementViewCount(link_id);

      // Track access event
      await this.trackAccess(link_id);

      return {
        success: true,
        allowed: true,
        composition: composition || undefined,
        download_url: link.allow_download ? link.export_url : undefined
      };
    } catch (error) {
      console.error('Access link error:', error);
      return {
        success: false,
        allowed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete/revoke a shared link
   */
  async revokeLink(linkId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('export_links')
        .delete()
        .eq('link_id', linkId);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Revoke link error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get link analytics
   */
  async getLinkAnalytics(linkId: string): Promise<any> {
    try {
      const { data: link } = await this.supabase
        .from('export_links')
        .select('*')
        .eq('link_id', linkId)
        .single();

      const { data: events } = await this.supabase
        .from('link_access_events')
        .select('*')
        .eq('link_id', linkId)
        .order('created_at', { ascending: false });

      return {
        link_id: linkId,
        view_count: link?.view_count || 0,
        download_count: link?.download_count || 0,
        created_at: link?.created_at,
        expires_at: link?.expires_at,
        is_active: link && (!link.expires_at || new Date(link.expires_at) > new Date()),
        recent_access: events?.slice(0, 10) || []
      };
    } catch (error) {
      console.error('Get link analytics error:', error);
      return null;
    }
  }

  /**
   * Update link settings
   */
  async updateLink(
    linkId: string,
    updates: {
      allow_download?: boolean;
      expires_in_days?: number;
      password?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {};

      if (updates.allow_download !== undefined) {
        updateData.allow_download = updates.allow_download;
      }

      if (updates.expires_in_days !== undefined) {
        updateData.expires_at = new Date(
          Date.now() + updates.expires_in_days * 24 * 60 * 60 * 1000
        ).toISOString();
      }

      if (updates.password) {
        updateData.password_hash = await this.hashPassword(updates.password);
        updateData.password_protected = true;
      }

      const { error } = await this.supabase
        .from('export_links')
        .update(updateData)
        .eq('link_id', linkId);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Update link error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate QR code for link
   */
  async generateQRCode(linkId: string): Promise<string> {
    // Placeholder - would integrate with QR code generation library
    const shareUrl = `${this.baseUrl}/view/${linkId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;
  }

  /**
   * Save link record to database
   */
  private async saveLinkRecord(record: any): Promise<void> {
    try {
      await this.supabase
        .from('export_links')
        .insert({
          ...record,
          created_at: new Date().toISOString(),
          view_count: 0,
          download_count: 0
        });
    } catch (error) {
      console.error('Save link record error:', error);
      throw error;
    }
  }

  /**
   * Increment view count
   */
  private async incrementViewCount(linkId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_view_count', { link_id: linkId });
    } catch (error) {
      // Fallback manual increment
      const { data: link } = await this.supabase
        .from('export_links')
        .select('view_count')
        .eq('link_id', linkId)
        .single();

      if (link) {
        await this.supabase
          .from('export_links')
          .update({ view_count: (link.view_count || 0) + 1 })
          .eq('link_id', linkId);
      }
    }
  }

  /**
   * Track access event
   */
  private async trackAccess(linkId: string): Promise<void> {
    try {
      await this.supabase
        .from('link_access_events')
        .insert({
          link_id: linkId,
          event_type: 'view',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to track access:', error);
    }
  }

  /**
   * Generate unique link ID
   */
  private generateLinkId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `${timestamp}${randomStr}`;
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - use bcrypt in production
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  /**
   * Cleanup expired links
   */
  async cleanupExpiredLinks(): Promise<{ deleted: number }> {
    try {
      const { data, error } = await this.supabase
        .from('export_links')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) {
        throw error;
      }

      return { deleted: data?.length || 0 };
    } catch (error) {
      console.error('Cleanup expired links error:', error);
      return { deleted: 0 };
    }
  }
}

/**
 * Create export link generator instance
 */
export function createExportLinkGenerator(): ExportLinkGenerator {
  return new ExportLinkGenerator();
}
