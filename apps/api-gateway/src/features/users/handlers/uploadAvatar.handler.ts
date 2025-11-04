import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/authenticate.middleware.js';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';
import formidable from 'formidable';
import fs from 'fs';

export async function uploadAvatarHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Não autorizado',
        code: 'UNAUTHORIZED'
      });
      return;
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
      res.status(400).json({
        error: 'Nenhum arquivo de imagem foi enviado',
        code: 'NO_FILE'
      });
      return;
    }

    // Validate file type
    if (!file.mimetype?.startsWith('image/')) {
      res.status(400).json({
        error: 'Arquivo deve ser uma imagem',
        code: 'INVALID_FILE_TYPE'
      });
      return;
    }

    // Generate filename
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

    // Upload file to Supabase Storage
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
      res.status(400).json({
        error: `Upload failed: ${error.message}`,
        code: 'UPLOAD_FAILED'
      });
      return;
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

    res.status(200).json({
      avatar_url: urlData.publicUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    throw error;
  }
}
