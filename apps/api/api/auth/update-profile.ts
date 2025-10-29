import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { validateEmail } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';

interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
  phone?: string | null;
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

const updateProfileHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['PUT', 'PATCH']));
  }

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
      console.error('Profile update error:', error);
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
    console.error('Unexpected profile update error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default compose(withCors, withAuth)(updateProfileHandler);