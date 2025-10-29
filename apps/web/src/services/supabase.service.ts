import { createClient } from '@supabase/supabase-js';

// Configuração do cliente Supabase para o frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service for handling file uploads to Supabase Storage
 */
export class SupabaseStorageService {
  private static readonly AVATAR_BUCKET = 'avatars';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Uploads an avatar image to Supabase Storage
   * @param file - The image file to upload
   * @param userId - The user ID to associate with the avatar
   * @returns Promise with the public URL of the uploaded image
   */
  static async uploadAvatar(file: File, userId: string): Promise<string> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error('File size exceeds 5MB limit');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.AVATAR_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.AVATAR_BUCKET)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  }

  /**
   * Deletes an avatar from Supabase Storage
   * @param filePath - The path of the file to delete
   */
  static async deleteAvatar(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.AVATAR_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Avatar delete error:', error);
      throw error;
    }
  }

  /**
   * Gets the public URL for an avatar
   * @param filePath - The path of the file
   * @returns The public URL
   */
  static getAvatarUrl(filePath: string): string {
    const { data } = supabase.storage
      .from(this.AVATAR_BUCKET)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }
}