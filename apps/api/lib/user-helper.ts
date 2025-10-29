import { supabaseAdmin } from './supabase.js';
import { logger } from './logger.js';

/**
 * Complete user data response interface
 */
export interface UserData {
  id: string;
  email: string;
  confirmed_at: string | null;
  phone: string | null;
  name: string;
  role: string;
  avatar_url: string | null;
  document_type: string | null;
  document_number: string | null;
}

/**
 * Fetches complete user data including profile information
 * @param userId - The user ID to fetch data for
 * @returns Complete user data or null if not found
 */
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    // Fetch user auth data
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authData.user) {
      logger.error('Error fetching auth data', { userId }, authError as Error);
      return null;
    }

    const user = authData.user;

    // Fetch avatar URL from storage
    let avatarUrl: string | null = null;
    try {
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from('avatars')
        .list('', { search: user.id });

      if (!listError && files && files.length > 0) {
        const avatarFile = files.find(file =>
          file.name.startsWith(user.id + '.') &&
          /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
        );

        if (avatarFile) {
          const { data: urlData } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(avatarFile.name);

          avatarUrl = urlData.publicUrl;
          logger.info('Avatar found', { userId }, { avatarName: avatarFile.name });
        }
      }
    } catch (error) {
      logger.error('Error fetching avatar', { userId }, error as Error);
    }

    // Fetch user profile data (document_type, document_number, role, etc.)
    let documentType: string | null = null;
    let documentNumber: string | null = null;
    let profileRole: string | null = null;

    try {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('document_type, document_number, role')
        .eq('user_id', user.id)
        .single();

      if (!profileError && profileData) {
        documentType = profileData.document_type;
        documentNumber = profileData.document_number;
        profileRole = profileData.role;
        logger.info('Profile data found', { userId }, { 
          documentType, 
          documentNumber: documentNumber ? '***' : null, 
          role: profileRole 
        });
      }
    } catch (error) {
      logger.error('Error fetching profile data', { userId }, error as Error);
    }

    // Build complete user data response
    // Priority: use role from user_metadata (source of truth), fallback to profile, then default
    const userData: UserData = {
      id: user.id,
      email: user.email || '',
      confirmed_at: user.confirmed_at || null,
      phone: user.user_metadata?.phone || null,
      name: user.user_metadata?.name || user.email?.split('@')[0] || '',
      role: user.user_metadata?.role || profileRole || 'user',
      avatar_url: avatarUrl,
      document_type: documentType,
      document_number: documentNumber
    };

    return userData;

  } catch (error) {
    logger.error('Unexpected error in getUserData', { userId }, error as Error);
    return null;
  }
}

