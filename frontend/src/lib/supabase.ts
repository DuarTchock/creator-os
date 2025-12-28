import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client for server components and API routes
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client for client components (handles auth automatically)
export const createBrowserClient = () => createClientComponentClient()

// Types for our database tables
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'pro' | 'agency'
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      deals: {
        Row: {
          id: string
          user_id: string
          brand_name: string
          brand_email: string | null
          brand_contact: string | null
          status: 'lead' | 'outreach' | 'negotiation' | 'closed_won' | 'closed_lost'
          amount: number | null
          currency: string
          category: string | null
          source: 'manual' | 'gmail' | 'instagram' | 'other'
          source_email_id: string | null
          notes: string | null
          pitch_draft: string | null
          deliverables: any[]
          deadline: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['deals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }
      comments: {
        Row: {
          id: string
          user_id: string
          platform: 'instagram' | 'youtube' | 'tiktok' | 'email' | 'other'
          content: string
          author_name: string | null
          author_handle: string | null
          post_url: string | null
          post_title: string | null
          sentiment: 'positive' | 'negative' | 'neutral' | 'question' | null
          cluster_id: string | null
          is_processed: boolean
          original_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      clusters: {
        Row: {
          id: string
          user_id: string
          theme: string
          summary: string | null
          comment_count: number
          sample_comments: string[]
          content_ideas: any[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clusters']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clusters']['Insert']>
      }
      integrations: {
        Row: {
          id: string
          user_id: string
          provider: 'gmail' | 'instagram' | 'youtube' | 'tiktok'
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          account_email: string | null
          account_name: string | null
          is_active: boolean
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['integrations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['integrations']['Insert']>
      }
    }
  }
}
