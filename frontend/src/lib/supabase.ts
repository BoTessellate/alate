import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Some features may not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// User management functions
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateUserEmail(newEmail: string) {
  const { data, error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
  return data;
}

export async function updateUserPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function deleteUserAccount(userId: string) {
  // Delete user's data from various tables
  const tables = ['looks', 'collections', 'user_products', 'user_preferences'];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId);

    if (error && error.code !== 'PGRST116') { // Ignore "table doesn't exist" errors
      console.warn(`Failed to delete from ${table}:`, error);
    }
  }

  // Note: Actual account deletion requires server-side admin API
  // This will be handled via an API endpoint
  return true;
}

export async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateUserPreferences(userId: string, preferences: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}
