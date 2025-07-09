// lib/supabase/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          name: string
          address: string | null
          type: string | null
          market: 'PHX' | 'LV' | null
          branch: string | null
          landscape_data: Json | null
          maintenance_data: Json | null
          total_landscape_hours: number | null
          calculated_drive_time: number | null
          bid_due_date: string | null
          status: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          type?: string | null
          market?: 'PHX' | 'LV' | null
          branch?: string | null
          landscape_data?: Json | null
          maintenance_data?: Json | null
          total_landscape_hours?: number | null
          calculated_drive_time?: number | null
          bid_due_date?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          type?: string | null
          market?: 'PHX' | 'LV' | null
          branch?: string | null
          landscape_data?: Json | null
          maintenance_data?: Json | null
          total_landscape_hours?: number | null
          calculated_drive_time?: number | null
          bid_due_date?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      active_properties: {
        Row: {
          id: string
          name: string
          address: string
          lat: number
          lng: number
          branch: string
          is_active: boolean
          uploaded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          lat: number
          lng: number
          branch: string
          is_active?: boolean
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          lat?: number
          lng?: number
          branch?: string
          is_active?: boolean
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}