import React, { useEffect, useState } from "react";
import { 
  FetchUserAttributesOutput, 
  fetchUserAttributes, 
  updateUserAttributes 
} from "aws-amplify/auth";
import { uploadData } from 'aws-amplify/storage';
import { FaEnvelope, FaUser, FaSpinner } from 'react-icons/fa';

function ProfilePage() {
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    const getUserAttributes = async () => {
      try {
        setIsLoading(true);
        const attributes = await fetchUserAttributes();
        setUserAttributes(attributes);
      } catch (error) {
        console.error('Unexpected error fetching user attributes:', error);
        setError('Failed to fetch user attributes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    getUserAttributes();
  }, []);

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      // Validate file type and size
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, or GIF.');
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File is too large. Maximum size is 5MB.');
      }

      // Upload the file to S3
      const upload = await uploadData({
        key: `profile-pictures/${userAttributes?.sub}/${Date.now()}-${file.name}`,
        data: file,
        options: {
          accessLevel: 'private'
        }
      });

      // Wait for the upload to complete
      const result = await upload.result;

      // Construct the image URL (adjust based on your storage configuration)
      const imageUrl = result.key; // Or however you want to generate the URL

      // Update user attributes with the new profile picture
      await updateUserAttributes({
        userAttributes: {
          picture: imageUrl
        }
      });

      // Update local state
      setUserAttributes(prev => prev ? {...prev, picture: imageUrl} : null);
      setError(null);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload profile picture');
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="profile-banner mb-6">
        <div className="profile-header flex flex-col items-center">
          {userAttributes?.picture ? (
            <img 
              src={userAttributes.picture} 
              alt="Profile" 
              className="w-32 h-32 rounded-full object-cover mb-4"
              aria-label="Profile Picture"
            />
          ) : (
            <div 
              className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-4"
              aria-label="No profile picture"
            >
              No picture
            </div>
          )}
          
          <div className="relative">
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/gif"
              onChange={handleProfilePictureUpload}
              className="hidden" 
              id="profile-picture-upload"
              disabled={isUploadingImage}
            />
            <label 
              htmlFor="profile-picture-upload" 
              className="btn btn-primary flex items-center cursor-pointer"
              aria-label="Upload profile picture"
            >
              {isUploadingImage ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                'Upload Profile Picture'
              )}
            </label>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mt-4">
          {userAttributes?.preferred_username || userAttributes?.email || 'User'}'s Profile
        </h1>
      </div>

      <div className="profile-info space-y-4">
        <div className="info-item flex items-center">
          <FaEnvelope className="mr-3 text-gray-500" />
          <div>
            <strong className="block text-gray-600">Email:</strong>
            <span>{userAttributes?.email || 'Not provided'}</span>
          </div>
        </div>
        
        <div className="info-item flex items-center">
          <FaUser className="mr-3 text-gray-500" />
          <div>
            <strong className="block text-gray-600">Preferred Name:</strong>
            <span>
              {userAttributes?.preferred_username || userAttributes?.username || 'Not set'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;