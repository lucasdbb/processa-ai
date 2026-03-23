import { useCallback } from 'react'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { FunctionalityType } from '@/features/ai/types'

export interface UploadedFileMetadata {
  bucket: string
  storage_path: string
  filename: string
}

export function useFileUpload() {
  const uploadFiles = useCallback(async (
    files: File[],
    client_id?: string | null,
    functionality: FunctionalityType = FunctionalityType.AI,
    onProgress?: (progress: number) => void
  ) => {
    const uploadMetadata: UploadedFileMetadata[] = []
    let firstJobUuid = ''
    const totalFiles = files.length
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i]
      
      // Progress start for this file
      if (onProgress) {
         onProgress(Math.round((i / totalFiles) * 100))
      }

      // 1. Get presigned URL
      const uploadUrlRes = await fetchWithCredentials(`${API_URL}/storage/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          client_id: client_id || undefined,
          functionality,
        }),
      })

      if (!uploadUrlRes.ok) {
        throw new Error(`Erro ao iniciar upload de ${file.name}. Tente novamente.`)
      }

      const uploadData = (await uploadUrlRes.json()) as {
        upload_url: string
        storage_path: string
        bucket: string
        job_uuid: string
      }

      if (!firstJobUuid) {
        firstJobUuid = uploadData.job_uuid
      }

      // 2. Upload to Supabase
      const uploadRes = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(`Erro ao fazer upload de ${file.name}.`)
      }

      uploadMetadata.push({
        bucket: uploadData.bucket,
        storage_path: uploadData.storage_path,
        filename: file.name,
      })

      // Progress end for this file
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalFiles) * 100))
      }
    }
    
    return { uploadMetadata, jobUuid: firstJobUuid }
  }, [])

  return { uploadFiles }
}
