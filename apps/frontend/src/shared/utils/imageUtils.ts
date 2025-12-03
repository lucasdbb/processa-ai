/**
 * Utility functions for image processing
 */

/**
 * Converts an image file to base64 with optional compression
 * @param file - The image file to convert
 * @param maxWidth - Maximum width for the image (default: 400px)
 * @param maxHeight - Maximum height for the image (default: 400px)
 * @param quality - JPEG quality (0-1, default: 0.8)
 * @returns Promise with base64 string
 */
export async function fileToBase64(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validates if a base64 string is a valid image
 * @param base64 - The base64 string to validate
 * @returns True if valid, false otherwise
 */
export function isValidBase64Image(base64: string): boolean {
  // Check if starts with data:image
  if (!base64.startsWith('data:image/')) {
    return false;
  }

  // Check if has base64 encoding
  if (!base64.includes('base64,')) {
    return false;
  }

  return true;
}

/**
 * Gets the size of a base64 string in bytes
 * @param base64 - The base64 string
 * @returns Size in bytes
 */
export function getBase64Size(base64: string): number {
  const base64Length = base64.split(',')[1]?.length || 0;
  return Math.ceil((base64Length * 3) / 4);
}

/**
 * Gets the size of a base64 string in human-readable format
 * @param base64 - The base64 string
 * @returns Size string (e.g., "150 KB")
 */
export function getBase64SizeFormatted(base64: string): string {
  const bytes = getBase64Size(base64);

  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
