import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type ComplaintCategory = 'pothole' | 'garbage' | 'streetlight' | 'water' | 'other';
export type ComplaintStatus = 'pranuar' | 'ne_punim' | 'zgjidhur';

export interface Complaint {
  id: string;
  category: ComplaintCategory;
  description: string;
  image_url: string | null;
  lat: number;
  lng: number;
  status: ComplaintStatus;
  reporter_token: string;
  confirmed_by_reporter: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  pothole: 'Gropë në rrugë',
  garbage: 'Plehra',
  streetlight: 'Ndriçim',
  water: 'Uji',
  other: 'Tjetër',
};

export const CATEGORY_ICONS: Record<ComplaintCategory, string> = {
  pothole: '🚧',
  garbage: '🗑️',
  streetlight: '💡',
  water: '💧',
  other: '📋',
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pranuar: 'Pranuar',
  ne_punim: 'Në punim',
  zgjidhur: 'Zgjidhur',
};

export const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pranuar: '#ef4444',
  ne_punim: '#f59e0b',
  zgjidhur: '#22c55e',
};

export const STATUS_BG_COLORS: Record<ComplaintStatus, string> = {
  pranuar: 'bg-red-100 text-red-700 border-red-200',
  ne_punim: 'bg-amber-100 text-amber-700 border-amber-200',
  zgjidhur: 'bg-green-100 text-green-700 border-green-200',
};
