//src/utils/profilePictureUploader.ts
import { useState } from 'react';
import { uploadImageWithThumbnails } from '../utils/imageUploadUtils';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export const useProfilePictureUploader = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const uploadProfilePicture = async (file: File, userId: string, refreshUserData: () => Promise<void>) => {
    if (!file || !userId) {
      setError('Please select a file and ensure you are logged in.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate the path with the userId
      const folder = `profile-pictures/${userId}`;

      // Upload the image and generate thumbnails
      const { originalPath, thumbnailPaths } = await uploadImageWithThumbnails(file, folder, 500, [200, 100]);

      if (!originalPath || thumbnailPaths.length === 0) {
        throw new Error('Invalid upload paths. Please try again.');
      }

      // Update the user entry in the Amplify backend schema
      await client.models.User.update({
        id: userId,
        picture: originalPath,
        pictureUrl: thumbnailPaths[0],
        updatedAt: new Date().toISOString(),
      });

      setSuccess('Profile picture updated successfully!');

      // Refresh user data to reflect the changes
      await refreshUserData();
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError('Failed to upload profile picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadProfilePicture,
    loading,
    error,
    success,
  };
};
