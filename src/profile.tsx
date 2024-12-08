import React, { useEffect, useState, useRef } from "react";
import { 
  FetchUserAttributesOutput, 
  fetchUserAttributes, 
  updateUserAttributes 
} from "aws-amplify/auth";
import { uploadData, getUrl } from 'aws-amplify/storage';
import { 
  FaEnvelope, 
  FaSpinner, 
  FaCamera, 
  FaEdit, 
  FaCheck, 
  FaTimes 
} from 'react-icons/fa';
import './ProfilePage.css';

const useSpoofData = true;

function ProfilePage() {
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);


  useEffect(() => {
    const getUserAttributes = async () => {
      try {
        setIsLoading(true);
        const attributes = await fetchUserAttributes();
        setUserAttributes(attributes);
        setEditedName(attributes.preferred_username || attributes.username || "");

        // Updated URL retrieval method
        if (attributes.picture) {
          try {
            const linkToStorageFile = await getUrl({ 
              path: attributes.picture,
              options: {
                expiresIn: 3600 // URL expires in 1 hour
              }
            });
            if(useSpoofData){setProfilePictureUrl("/profileDefault.png")}
            else {setProfilePictureUrl(linkToStorageFile.url.toString());}
          } catch (urlError) {
            console.error('Error retrieving profile picture URL:', urlError);
            setProfilePictureUrl("/profileDefault.png"); // Fallback image
          }
        }

        
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

      const path = `profile-pictures/${userAttributes?.sub}/${Date.now()}-${file.name}`
      // Upload the file to S3
      const upload = await uploadData({
        path,
        data: file
      });

      // Wait for the upload to complete
      await upload.result;

      // Update user attributes with the new profile picture
      await updateUserAttributes({
        userAttributes: {
          picture: path
        }
      });

      // Retrieve and set the new profile picture URL
      const linkToStorageFile = await getUrl({ 
        path,
        options: {
          expiresIn: 3600 // URL expires in 1 hour
        }
      });

      // Update local state
      setUserAttributes(prev => prev ? {...prev, picture: path} : null);
      setProfilePictureUrl(linkToStorageFile.url.toString());
      setError(null);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload profile picture');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateName = async () => {
    try {
      await updateUserAttributes({
        userAttributes: {
          preferred_username: editedName
        }
      });

      setUserAttributes(prev => 
        prev ? {...prev, preferred_username: editedName} : null
      );

      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
      setError('Failed to update name. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="profile-loading-container">
        <FaSpinner className="profile-loading-spinner" />
        <span className="profile-loading-text">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {error && (
        <div className="profile-error-message">
          {error}
        </div>
      )}

      <div className="profile-banner">
        <div className="profile-header">
          {userAttributes?.picture ? (
            <div className="profile-picture-wrapper">
              <img 
                src={profilePictureUrl || "/picsoritdidnthappen.webp"} 
                alt="Profile" 
                className="profile-picture"
                aria-label="Profile Picture"
              />
              <button 
                className="profile-picture-overlay"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaCamera className="profile-picture-camera-icon" />
              </button>
            </div>
          ) : (
            <div 
              className="profile-picture-placeholder"
              aria-label="No profile picture"
            >
              No picture
            </div>
          )}
          
          <input 
            type="file" 
            accept="image/jpeg,image/png,image/gif"
            onChange={handleProfilePictureUpload}
            className="profile-picture-input" 
            id="profile-picture-upload"
            disabled={isUploadingImage}
            ref={fileInputRef}
          />
          <label 
            htmlFor="profile-picture-upload" 
            className="profile-picture-upload-button"
            aria-label="Upload profile picture"
          >
            {isUploadingImage ? (
              <>
                <FaSpinner className="profile-upload-spinner" />
                Uploading...
              </>
            ) : (
              'Upload Profile Picture'
            )}
          </label>

          <div className="profile-name-section">
            {isEditingName ? (
              <div className="profile-name-edit-container">
                <input 
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="profile-name-input"
                />
                <button 
                  onClick={handleUpdateName}
                  className="profile-name-confirm-button"
                >
                  <FaCheck />
                </button>
                <button 
                  onClick={() => {
                    setIsEditingName(false);
                    setEditedName(userAttributes?.preferred_username || userAttributes?.username || "");
                  }}
                  className="profile-name-cancel-button"
                >
                  <FaTimes />
                </button>
              </div>
            ) : (
              <div className="profile-name-display">
                <h1 className="profile-name">
                  {userAttributes?.preferred_username || userAttributes?.username || 'User'}
                </h1>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="profile-name-edit-button"
                >
                  <FaEdit />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="profile-info-section">
        <div className="profile-info-item">
          <FaEnvelope className="profile-info-icon" />
          <div className="profile-info-text">
            <strong className="profile-info-label">Email:</strong>
            <span className="profile-info-value">{userAttributes?.email || 'Not provided'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;