/*
# Create complaints table for Prishtina Raporton

1. New Tables
- `complaints`
  - `id` (uuid, primary key)
  - `category` (text, not null) — one of: pothole, garbage, streetlight, water, other
  - `description` (text, not null)
  - `image_url` (text) — URL of uploaded photo in Supabase storage
  - `lat` (numeric, not null) — latitude of complaint location
  - `lng` (numeric, not null) — longitude of complaint location
  - `status` (text, not null, default 'pranuar') — one of: pranuar, ne_punim, zgjidhur
  - `reporter_token` (text, not null) — random token to identify the original reporter for confirm-resolved
  - `confirmed_by_reporter` (boolean, default false) — citizen confirmed the issue was actually fixed
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Storage
- Public bucket `complaint-photos` for citizen-uploaded complaint images.

3. Security
- Enable RLS on `complaints`.
- Allow anon + authenticated CRUD because this is a public civic platform (no sign-in).
- All data is intentionally public/shared — any citizen can see all complaints on the map.
*/

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('pothole', 'garbage', 'streetlight', 'water', 'other')),
  description text NOT NULL,
  image_url text,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  status text NOT NULL DEFAULT 'pranuar' CHECK (status IN ('pranuar', 'ne_punim', 'zgjidhur')),
  reporter_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  confirmed_by_reporter boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_complaints" ON complaints;
CREATE POLICY "anon_select_complaints" ON complaints FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_complaints" ON complaints;
CREATE POLICY "anon_insert_complaints" ON complaints FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_complaints" ON complaints;
CREATE POLICY "anon_update_complaints" ON complaints FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_complaints" ON complaints;
CREATE POLICY "anon_delete_complaints" ON complaints FOR DELETE
  TO anon, authenticated USING (true);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS complaints_updated_at ON complaints;
CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- Create storage bucket for complaint photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-photos', 'complaint-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of complaint photos
DROP POLICY IF EXISTS "Public read complaint photos" ON storage.objects;
CREATE POLICY "Public read complaint photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'complaint-photos');

-- Allow anon + authenticated to upload complaint photos
DROP POLICY IF EXISTS "Public upload complaint photos" ON storage.objects;
CREATE POLICY "Public upload complaint photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'complaint-photos');

-- Allow anon + authenticated to delete complaint photos
DROP POLICY IF EXISTS "Public delete complaint photos" ON storage.objects;
CREATE POLICY "Public delete complaint photos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'complaint-photos');