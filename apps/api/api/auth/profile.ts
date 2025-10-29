import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { validateEmail } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';
import { getUserData } from '../../lib/user-helper.js';
import { logger, createRequestContext } from '../../lib/logger.js';
import { withRateLimit, rateLimitConfigs } from '../../lib/rate-limit.js';
import formidable from 'formidable';
import fs from 'fs';

// ==================== TYPES ====================

interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
  phone?: string | null;
}

interface UploadAvatarResponse {
  avatar_url: string;
  message: string;
}

interface UserDetailsResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    createdAt: string;
    emailVerified: boolean;
    lastSignIn?: string;
    userMetadata: Record<string, any>;
    rawUserMetadata: Record<string, any>;
    appMetadata: Record<string, any>;
  };
}

interface UpdateProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    phone?: string | null;
    createdAt: string;
    emailVerified: boolean;
  };
  message: string;
}

// ==================== HANDLERS ====================

/**
 * GET /auth/profile
 * Retorna dados básicos do usuário atual (usado para manter sessão)
 */
const handleGetMe = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    // Fetch complete user data including profile information
    const userData = await getUserData(req.user.id);

    if (!userData) {
      const context = createRequestContext(req);
      logger.error('Failed to fetch user data', context, undefined, { userId: req.user.id });
      return res.status(500).json({
        error: 'Erro ao carregar dados do usuário',
        code: 'USER_DATA_FETCH_FAILED'
      });
    }

    return res.status(200).json(userData);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected me error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * GET /auth/profile?details=true
 * Retorna dados completos do usuário (incluindo todos os metadados)
 */
const handleGetDetails = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    // Buscar dados completos do usuário usando o admin client
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      const context = createRequestContext(req);
      logger.error('Error fetching user details', context, error as Error);
      return res.status(400).json({
        error: 'Erro ao buscar dados do usuário',
        code: 'FETCH_USER_ERROR'
      });
    }

    if (!data.user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = data.user;

    // Formatar resposta com todos os metadados
    const response: UserDetailsResponse = {
      user: {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || '',
        role: user.user_metadata?.role || user.app_metadata?.role || 'user',
        avatar: user.user_metadata?.avatar,
        createdAt: user.created_at || '',
        emailVerified: user.email_confirmed_at !== null,
        lastSignIn: user.last_sign_in_at || undefined,

        // Todos os tipos de metadata
        userMetadata: user.user_metadata || {},
        rawUserMetadata: user.user_metadata || {},
        appMetadata: user.app_metadata || {}
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected error fetching user details', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * PUT/PATCH /auth/profile
 * Atualiza dados do perfil do usuário
 */
const handleUpdateProfile = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    const { name, email, avatar, phone }: UpdateProfileRequest = req.body;

    // Validate that at least one field is provided
    if (!name && !email && !avatar && phone === undefined) {
      return res.status(400).json({
        error: 'Pelo menos um campo deve ser fornecido para atualização',
        code: 'NO_FIELDS_PROVIDED'
      });
    }

    // Validate email if provided
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({
          error: emailValidation.error,
          code: emailValidation.code
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    const userMetadataUpdate: any = {};

    if (email) {
      updateData.email = email;
    }

    if (name) {
      userMetadataUpdate.name = name;
    }

    if (avatar) {
      userMetadataUpdate.avatar = avatar;
    }

    if (phone !== undefined) {
      userMetadataUpdate.phone = phone;
    }

    // Update user metadata if there are changes
    if (Object.keys(userMetadataUpdate).length > 0) {
      updateData.user_metadata = userMetadataUpdate;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateData
    );

    if (error) {
      const context = createRequestContext(req);
      logger.error('Profile update error', context, error as Error);
      return res.status(400).json(mapSupabaseError(error));
    }

    if (!data.user) {
      return res.status(400).json({
        error: 'Falha ao atualizar perfil',
        code: 'UPDATE_FAILED'
      });
    }

    // Format response
    const response: UpdateProfileResponse = {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || '',
        role: data.user.user_metadata?.role || 'user',
        avatar: data.user.user_metadata?.avatar,
        phone: data.user.user_metadata?.phone || null,
        createdAt: data.user.created_at || '',
        emailVerified: data.user.email_confirmed_at !== null
      },
      message: 'Perfil atualizado com sucesso'
    };

    return res.status(200).json(response);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected profile update error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * POST /auth/profile?action=upload-avatar
 * Upload de avatar do usuário (multipart/form-data)
 */
const handleUploadAvatar = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    const userId = req.user.id;

    // Parse multipart form data
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowEmptyFiles: false,
      filter: ({ mimetype }) => {
        return Boolean(mimetype && mimetype.startsWith('image/'));
      }
    });

    const [, files] = await form.parse(req);

    const file = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;

    if (!file) {
      return res.status(400).json({
        error: 'Nenhum arquivo de imagem foi enviado',
        code: 'NO_FILE'
      });
    }

    // Validate file type
    if (!file.mimetype?.startsWith('image/')) {
      return res.status(400).json({
        error: 'Arquivo deve ser uma imagem',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Generate filename using convention: userId.extension
    const fileExt = file.originalFilename?.split('.').pop() || 'jpg';
    const fileName = `${userId}.${fileExt}`;

    // Read file content
    const fileContent = fs.readFileSync(file.filepath);

    // Remove existing avatar if any
    try {
      const { data: existingFiles } = await supabaseAdmin.storage
        .from('avatars')
        .list('', { search: userId });

      if (existingFiles) {
        const existingAvatar = existingFiles.find(f =>
          f.name.startsWith(userId + '.') &&
          /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)
        );

        if (existingAvatar) {
          await supabaseAdmin.storage
            .from('avatars')
            .remove([existingAvatar.name]);
          const context = createRequestContext(req);
          logger.info('Removed existing avatar', context, { avatarName: existingAvatar.name });
        }
      }
    } catch (error) {
      const context = createRequestContext(req);
      logger.warn('Could not remove existing avatar', context, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Upload file to Supabase Storage using admin client
    const { error } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, fileContent, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.mimetype
      });

    if (error) {
      const context = createRequestContext(req);
      logger.error('Upload error', context, error as Error);
      return res.status(400).json({
        error: `Upload failed: ${error.message}`,
        code: 'UPLOAD_FAILED'
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update user metadata with avatar path
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        avatar_path: fileName
      }
    });

    // Clean up temporary file
    fs.unlinkSync(file.filepath);

    const response: UploadAvatarResponse = {
      avatar_url: urlData.publicUrl,
      message: 'Avatar uploaded successfully'
    };

    return res.status(200).json(response);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Avatar upload error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// ==================== MAIN HANDLER ====================

const profileHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  const action = req.query.action as string | undefined;

  // GET requests
  if (req.method === 'GET') {
    // Check if details are requested
    const details = req.query.details === 'true';
    if (details) {
      return handleGetDetails(req, res);
    }
    return handleGetMe(req, res);
  }

  // POST requests (for file upload)
  if (req.method === 'POST') {
    if (action === 'upload-avatar') {
      return handleUploadAvatar(req, res);
    }
    return res.status(400).json({
      error: 'Ação inválida. Use: upload-avatar',
      code: 'INVALID_ACTION'
    });
  }

  // PUT/PATCH requests
  if (req.method === 'PUT' || req.method === 'PATCH') {
    return handleUpdateProfile(req, res);
  }

  return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET', 'POST', 'PUT', 'PATCH']));
};

// ==================== MIDDLEWARE COMPOSITION ====================

// Aplicar rate limiting restritivo apenas para upload de avatar
const conditionalMiddleware = async (req: AuthenticatedRequest, res: VercelResponse) => {
  const action = req.query.action as string | undefined;

  // Upload de avatar requer rate limiting restritivo
  if (req.method === 'POST' && action === 'upload-avatar') {
    return compose(
      withCors,
      withAuth,
      withRateLimit(rateLimitConfigs.upload)
    )(profileHandler)(req, res);
  }

  // Outras operações usam middlewares padrão
  return compose(withCors, withAuth)(profileHandler)(req, res);
};

// ==================== EXPORT ====================

export default conditionalMiddleware;
