/**
 * Moodboards API - CRUD operations for user moodboards
 * Stores moodboard data in Supabase
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
      case 'GET':
        if (id) {
          // Get single moodboard
          const { data: moodboard, error: getError } = await supabase
            .from('moodboards')
            .select('*')
            .eq('id', id)
            .single();

          if (getError) {
            return res.status(404).json({ error: 'Moodboard not found' });
          }

          return res.status(200).json({ moodboard });
        } else {
          // Get all moodboards (optionally filter by user_id)
          const { user_id } = req.query;
          let query = supabase.from('moodboards').select('*').order('updated_at', { ascending: false });

          if (user_id) {
            query = query.eq('user_id', user_id);
          }

          const { data: moodboards, error: listError } = await query;

          if (listError) {
            return res.status(500).json({ error: listError.message });
          }

          return res.status(200).json({ moodboards: moodboards || [] });
        }

      case 'POST':
        // Create new moodboard
        const createData = req.body;

        if (!createData.name) {
          return res.status(400).json({ error: 'Moodboard name is required' });
        }

        const newMoodboard = {
          name: createData.name,
          description: createData.description || null,
          user_id: createData.user_id || 'anonymous',
          products: createData.products || [],
          theme: createData.theme || null,
          canvas_size: createData.canvas_size || { width: 1200, height: 800 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: createError } = await supabase
          .from('moodboards')
          .insert(newMoodboard)
          .select()
          .single();

        if (createError) {
          console.error('Create error:', createError);
          return res.status(500).json({ error: createError.message });
        }

        return res.status(201).json({ moodboard: created });

      case 'PUT':
        // Update moodboard
        if (!id) {
          return res.status(400).json({ error: 'Moodboard ID is required' });
        }

        const updateData = {
          ...req.body,
          updated_at: new Date().toISOString(),
        };

        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.created_at;

        const { data: updated, error: updateError } = await supabase
          .from('moodboards')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          return res.status(500).json({ error: updateError.message });
        }

        return res.status(200).json({ moodboard: updated });

      case 'DELETE':
        // Delete moodboard
        if (!id) {
          return res.status(400).json({ error: 'Moodboard ID is required' });
        }

        const { error: deleteError } = await supabase
          .from('moodboards')
          .delete()
          .eq('id', id);

        if (deleteError) {
          return res.status(500).json({ error: deleteError.message });
        }

        return res.status(200).json({ success: true });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Moodboards API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
