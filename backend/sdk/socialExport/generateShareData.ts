/**
 * Social Share Data Generation
 * Prepares moodboard metadata for Pinterest, Instagram, and other platforms
 */

import { MoodboardComposition } from '../moodboardComposer/composeBoard';
import { createClient } from '@supabase/supabase-js';

export interface ShareDataRequest {
  composition: MoodboardComposition;
  platforms: SharePlatform[];
  custom_message?: string;
  include_product_links?: boolean;
}

export type SharePlatform = 'pinterest' | 'instagram' | 'facebook' | 'twitter' | 'generic';

export interface ShareData {
  success: boolean;
  share_id: string;
  platforms: {
    [key in SharePlatform]?: PlatformShareData;
  };
  preview_url: string;
  share_url: string;
}

export interface PlatformShareData {
  platform: SharePlatform;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  metadata: {
    [key: string]: any;
  };
  share_link?: string;
}

/**
 * Social Share Data Generator
 */
export class ShareDataGenerator {
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
   * Generate share data for multiple platforms
   */
  async generateShareData(request: ShareDataRequest): Promise<ShareData> {
    try {
      const {
        composition,
        platforms,
        custom_message,
        include_product_links = true
      } = request;

      // Generate unique share ID
      const shareId = this.generateShareId();

      // Get or create preview image URL
      const previewUrl = await this.getPreviewUrl(composition);

      // Create share URL
      const shareUrl = `${this.baseUrl}/share/${shareId}`;

      // Generate platform-specific data
      const platformData: ShareData['platforms'] = {};

      for (const platform of platforms) {
        platformData[platform] = await this.generatePlatformData(
          platform,
          composition,
          previewUrl,
          shareUrl,
          custom_message,
          include_product_links
        );
      }

      // Save share record to database
      await this.saveShareRecord(shareId, composition, platformData);

      return {
        success: true,
        share_id: shareId,
        platforms: platformData,
        preview_url: previewUrl,
        share_url: shareUrl
      };
    } catch (error) {
      console.error('Generate share data error:', error);
      throw error;
    }
  }

  /**
   * Generate platform-specific share data
   */
  private async generatePlatformData(
    platform: SharePlatform,
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string,
    includeProductLinks: boolean = true
  ): Promise<PlatformShareData> {
    switch (platform) {
      case 'pinterest':
        return this.generatePinterestData(composition, previewUrl, shareUrl, customMessage, includeProductLinks);
      case 'instagram':
        return this.generateInstagramData(composition, previewUrl, shareUrl, customMessage);
      case 'facebook':
        return this.generateFacebookData(composition, previewUrl, shareUrl, customMessage);
      case 'twitter':
        return this.generateTwitterData(composition, previewUrl, shareUrl, customMessage);
      default:
        return this.generateGenericData(composition, previewUrl, shareUrl, customMessage);
    }
  }

  /**
   * Generate Pinterest-specific data
   */
  private generatePinterestData(
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string,
    includeProductLinks: boolean = true
  ): PlatformShareData {
    const productNames = composition.products.map(p => p.product_name).join(', ');
    const brands = [...new Set(composition.products.map(p => p.brand))].join(', ');
    const allTags = [...new Set(composition.products.flatMap(p => p.tags))];

    const title = customMessage || `${composition.name} - ${composition.products.length} curated products`;
    const description = `Discover ${composition.products.length} handpicked products featuring ${brands}. ${includeProductLinks ? `Products: ${productNames}` : ''} Created with Mood Layer.`;

    return {
      platform: 'pinterest',
      title,
      description: description.substring(0, 500), // Pinterest limit
      image_url: previewUrl,
      tags: allTags.slice(0, 20), // Pinterest allows up to 20 tags
      metadata: {
        board_name: composition.name,
        product_count: composition.products.length,
        layout_type: composition.layout.layout_type,
        link: shareUrl
      },
      share_link: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(previewUrl)}&description=${encodeURIComponent(title)}`
    };
  }

  /**
   * Generate Instagram-specific data
   */
  private generateInstagramData(
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string
  ): PlatformShareData {
    const allTags = [...new Set(composition.products.flatMap(p => p.tags))];
    const hashtags = allTags.slice(0, 30).map(tag => `#${tag.replace(/\s+/g, '')}`);

    const title = customMessage || composition.name;
    const description = `${composition.name}\n\n✨ ${composition.products.length} handpicked products\n${hashtags.join(' ')}\n\nCreate your own moodboard at ${this.baseUrl}`;

    return {
      platform: 'instagram',
      title,
      description: description.substring(0, 2200), // Instagram caption limit
      image_url: previewUrl,
      tags: allTags,
      metadata: {
        aspect_ratio: '1:1', // Instagram prefers square
        hashtags,
        link: shareUrl
      }
    };
  }

  /**
   * Generate Facebook-specific data
   */
  private generateFacebookData(
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string
  ): PlatformShareData {
    const productCount = composition.products.length;
    const brands = [...new Set(composition.products.map(p => p.brand))];

    const title = customMessage || `${composition.name} - Curated Moodboard`;
    const description = `Check out this collection of ${productCount} beautiful products from ${brands.join(', ')}. Created with Mood Layer.`;

    return {
      platform: 'facebook',
      title,
      description,
      image_url: previewUrl,
      tags: [...new Set(composition.products.flatMap(p => p.tags))],
      metadata: {
        og_title: title,
        og_description: description,
        og_image: previewUrl,
        og_url: shareUrl
      },
      share_link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    };
  }

  /**
   * Generate Twitter-specific data
   */
  private generateTwitterData(
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string
  ): PlatformShareData {
    const tags = [...new Set(composition.products.flatMap(p => p.tags))].slice(0, 3);
    const hashtags = tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');

    const title = customMessage || composition.name;
    const description = `${title}\n\n${composition.products.length} curated products ${hashtags}\n\nCreated with @MoodLayer`;

    return {
      platform: 'twitter',
      title,
      description: description.substring(0, 280), // Twitter character limit
      image_url: previewUrl,
      tags,
      metadata: {
        twitter_card: 'summary_large_image',
        twitter_title: title,
        twitter_description: description.substring(0, 200),
        twitter_image: previewUrl
      },
      share_link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(description)}&url=${encodeURIComponent(shareUrl)}`
    };
  }

  /**
   * Generate generic share data
   */
  private generateGenericData(
    composition: MoodboardComposition,
    previewUrl: string,
    shareUrl: string,
    customMessage?: string
  ): PlatformShareData {
    const title = customMessage || composition.name;
    const description = `Moodboard featuring ${composition.products.length} curated products. Created with Mood Layer.`;

    return {
      platform: 'generic',
      title,
      description,
      image_url: previewUrl,
      tags: [...new Set(composition.products.flatMap(p => p.tags))],
      metadata: {
        product_count: composition.products.length,
        layout_type: composition.layout.layout_type,
        share_url: shareUrl
      }
    };
  }

  /**
   * Get or create preview URL for composition
   */
  private async getPreviewUrl(composition: MoodboardComposition): Promise<string> {
    // Check if composition already has an export URL
    const { data } = await this.supabase
      .from('moodboard_compositions')
      .select('export_url')
      .eq('id', composition.id)
      .single();

    if (data?.export_url) {
      return data.export_url;
    }

    // Generate preview URL (placeholder - actual rendering would be done by export engine)
    return `${this.baseUrl}/api/preview/${composition.id}.png`;
  }

  /**
   * Save share record to database
   */
  private async saveShareRecord(
    shareId: string,
    composition: MoodboardComposition,
    platformData: ShareData['platforms']
  ): Promise<void> {
    try {
      await this.supabase
        .from('social_shares')
        .insert({
          share_id: shareId,
          composition_id: composition.id,
          platform_data: platformData,
          created_at: new Date().toISOString(),
          view_count: 0
        });
    } catch (error) {
      console.warn('Failed to save share record:', error);
      // Don't throw - sharing can still work without database record
    }
  }

  /**
   * Generate unique share ID
   */
  private generateShareId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `share_${timestamp}_${randomStr}`;
  }

  /**
   * Track share event
   */
  async trackShare(shareId: string, platform: SharePlatform): Promise<void> {
    try {
      await this.supabase
        .from('share_events')
        .insert({
          share_id: shareId,
          platform,
          event_type: 'share',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to track share:', error);
    }
  }

  /**
   * Get share analytics
   */
  async getShareAnalytics(shareId: string): Promise<any> {
    try {
      const { data: shareData } = await this.supabase
        .from('social_shares')
        .select('*')
        .eq('share_id', shareId)
        .single();

      const { data: events } = await this.supabase
        .from('share_events')
        .select('*')
        .eq('share_id', shareId);

      return {
        share_id: shareId,
        view_count: shareData?.view_count || 0,
        share_count: events?.filter((e: any) => e.event_type === 'share').length || 0,
        click_count: events?.filter((e: any) => e.event_type === 'click').length || 0,
        platforms: events?.reduce((acc: any, e: any) => {
          acc[e.platform] = (acc[e.platform] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get share analytics error:', error);
      return null;
    }
  }
}

/**
 * Create share data generator instance
 */
export function createShareDataGenerator(): ShareDataGenerator {
  return new ShareDataGenerator();
}
