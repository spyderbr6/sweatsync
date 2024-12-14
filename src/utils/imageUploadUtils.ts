// src/utils/imageUploadUtils.ts
import { uploadData } from 'aws-amplify/storage';


/**
 * Resizes an image file to fit within specified dimensions.
 * @param file The original image file.
 * @param maxSize The maximum size (width/height) for the resized image.
 * @returns A Blob representing the resized image.
 */
export async function resizeImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
  
      img.onload = () => {
        let width = img.width;
        let height = img.height;
  
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
  
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
  
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to resize image'));
        }, 'image/jpeg', 0.8); // Compression quality set to 80%
      };
  
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

/**
 * Generates a thumbnail for a given image file.
 * @param file The original image file.
 * @param maxSize The maximum size (width/height) for the thumbnail.
 * @returns A Blob representing the thumbnail.
 */
export async function createThumbnail(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create thumbnail'));
      }, 'image/jpeg', 0.7);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
/**
 * Converts a Blob to a File.
 * @param blob The Blob to convert.
 * @param fileName The name to assign to the new File.
 * @returns A File instance.
 */
function blobToFile(blob: Blob, fileName: string): File {
    return new File([blob], fileName, { type: blob.type, lastModified: Date.now() });
  }
  
  /**
   * Uploads an image and its thumbnails to S3.
   * @param file The original image file.
   * @param basePath The base path in S3 (e.g., 'profile-pictures' or 'workout-pictures').
   * @param maxOriginalSize The maximum resolution for the original image.
   * @param thumbnailSizes An array of sizes for generating thumbnails.
   * @returns The paths for the original image and thumbnails.
   */
  export async function uploadImageWithThumbnails(
    file: File,
    basePath: string,
    maxOriginalSize: number = 1200,
    thumbnailSizes: number[] = [200, 400]
  ): Promise<{ originalPath: string; thumbnailPaths: string[] }> {
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const originalPath = `${basePath}/original/${uniqueFileName}`;
  
    // Resize the original image before uploading
    const resizedImageBlob = await resizeImage(file, maxOriginalSize);
    const resizedImageFile = blobToFile(resizedImageBlob, uniqueFileName);
  
    // Upload the resized original image
    await uploadData({ path: originalPath, data: resizedImageFile });
  
    // Generate and upload thumbnails
    const thumbnailPaths = await Promise.all(
      thumbnailSizes.map(async (size) => {
        const thumbnailBlob = await createThumbnail(resizedImageFile, size);
        const thumbnailFile = blobToFile(thumbnailBlob, `${uniqueFileName}_${size}x${size}`);
        const thumbnailPath = `${basePath}/thumbnails/${thumbnailFile.name}`;
        await uploadData({ path: thumbnailPath, data: thumbnailFile });
        return thumbnailPath;
      })
    );
  
    return { originalPath, thumbnailPaths };
  }