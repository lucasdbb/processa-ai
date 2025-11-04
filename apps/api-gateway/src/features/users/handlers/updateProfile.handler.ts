import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/authenticate.middleware.js';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
  phone?: string | null;
}

export async function updateProfileHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Não autorizado',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const { name, email, avatar, phone }: UpdateProfileRequest = req.body;

    // Validate that at least one field is provided
    if (!name && !email && !avatar && phone === undefined) {
      res.status(400).json({
        error: 'Pelo menos um campo deve ser fornecido para atualização',
        code: 'NO_FIELDS_PROVIDED'
      });
      return;
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
      res.status(400).json(mapSupabaseError(error));
      return;
    }

    if (!data.user) {
      res.status(400).json({
        error: 'Falha ao atualizar perfil',
        code: 'UPDATE_FAILED'
      });
      return;
    }

    // Format response
    res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || '',
        role: data.user.user_metadata?.role || 'user',
        avatar: data.user.user_metadata?.avatar,
        phone: data.user.user_metadata?.phone || null,
        created_at: data.user.created_at || '',
        email_verified: data.user.email_confirmed_at !== null
      },
      message: 'Perfil atualizado com sucesso'
    });
  } catch (error) {
    throw error;
  }
}
