import { createClient } from '@supabase/supabase-js';
import { authService } from './auth.service';

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

  /**
   * Uploads an avatar image via API endpoint
   * @param file - The image file to upload
   * @returns Promise with the public URL of the uploaded image
   */
  static async uploadAvatar(file: File): Promise<string> {
    try {
      console.log('Starting avatar upload via API:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        apiUrl: import.meta.env.VITE_API_URL
      });

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('avatar', file);

      // Get auth token from auth service
      const accessToken = authService.getAccessToken();
      console.log('Auth token status:', { hasToken: !!accessToken });
      
      if (!accessToken) {
        throw new Error('Usuário não autenticado');
      }

      const apiUrl = `${import.meta.env.VITE_API_URL}/api/auth/upload-avatar`;
      console.log('Making request to:', apiUrl);

      // Upload via API endpoint
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.log('Error response data:', errorData);
        } catch (parseError) {
          console.log('Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload successful via API:', result);

      return result.avatar_url;
    } catch (error) {
      console.error('Avatar upload error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
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