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

      // Generate the path with the userId
      const folder = `profile-pictures/${userId}`;

      // Upload the image and generate thumbnails
      const { originalPath, thumbnailPaths } = await uploadImageWithThumbnails(file, folder, 500, [200, 100]);

      // Debugging: Check the paths before updating the user
      if (!originalPath || thumbnailPaths.length === 0) {
        setError('Invalid upload paths. Please try again.');
        return;
      }

      // Update the user entry in the Amplify backend schema
      try {

        const updateResult = await client.models.User.update({
          id: userId,
          picture: originalPath,
          pictureUrl: thumbnailPaths[0],
          updatedAt: new Date().toISOString(),
        });

        console.log('User update result:', updateResult);

        if (!updateResult.data) {
          throw new Error('User update returned no data.');
        }
      } catch (updateError) {
        console.error('Error updating user in Amplify:', updateError);
        setError('Failed to update user profile. Please try again.');
        return;
      }

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
