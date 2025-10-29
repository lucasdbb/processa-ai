import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';
import { withRateLimit, rateLimitConfigs } from '../../lib/rate-limit.js';
import { logger, createRequestContext } from '../../lib/logger.js';
import formidable from 'formidable';
import fs from 'fs';

interface UploadAvatarResponse {
  avatar_url: string;
  message: string;
}

const uploadAvatarHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

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

// Aplicar Rate Limiting para uploads (restritivo)
export default compose(
  withCors,
  withAuth,
  withRateLimit(rateLimitConfigs.upload)
)(uploadAvatarHandler);