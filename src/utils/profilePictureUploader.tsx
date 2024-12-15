import React, { useState } from 'react';
import { uploadImageWithThumbnails } from '../utils/imageUploadUtils';
import { useUser } from '../userContext';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

const ProfilePictureUploader: React.FC = () => {
  const { userId, refreshUserData } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !userId) {
      setError('Please select a file and ensure you are logged in.');
      return;
    }


    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Upload the image and generate thumbnails with a max resolution of 500px
      const { originalPath, thumbnailPaths } = await uploadImageWithThumbnails(file, 'profile-pictures', 500, [200, 100]);

      // Update the user's profile with the new image paths
      await client.models.User.update({
        id: userId,
        picture: originalPath,
        pictureUrl: thumbnailPaths[0], // Use the first thumbnail (200x200) as the default
        updatedAt: new Date().toISOString(),
      });

      setSuccess('Profile picture updated successfully!');
      setFile(null);

      // Refresh user data to reflect the changes
      await refreshUserData();
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError('Failed to upload profile picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Upload Profile Picture</h3>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </div>
  );
};

export default ProfilePictureUploader;
