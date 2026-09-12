import { supabase } from './supabase';

export async function uploadComplaintPhoto(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('complaint-photos')
    .upload(fileName, file, { contentType: file.type });

  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('complaint-photos').getPublicUrl(fileName);
  return data.publicUrl;
}
