import React, { useEffect, useState } from "react";
import { FaEnvelope, FaSpinner, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { useUser } from "./userContext";
import { useProfilePictureUploader } from './utils/profilePictureUploader';
import './ProfilePage.css';
import { 
  FetchUserAttributesOutput, 
  fetchUserAttributes, 
  updateUserAttributes 
} from "aws-amplify/auth";
import { useUrlCache } from './urlCacheContext';


function ProfilePage() {
  const { picture, userId, refreshUserData } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
  const { getStorageUrl } = useUrlCache();
  const {
    uploadProfilePicture,
    loading: uploadLoading,
    error: uploadError,
    success: uploadSuccess,
  } = useProfilePictureUploader();

  useEffect(() => {
    const getUserAttributes = async () => {
      try {
        setIsLoading(true);
        const attributes = await fetchUserAttributes();
        setUserAttributes(attributes);
        setEditedName(attributes.preferred_username || attributes.username || "");

      } catch (error) {
        setError('Failed to fetch user attributes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    getUserAttributes();
  }, [getStorageUrl]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadProfilePicture(e.target.files[0], userId!, refreshUserData);
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
      {error && <div className="profile-error-message">{error}</div>}
      {uploadError && <div className="profile-error-message">{uploadError}</div>}
      {uploadSuccess && <div className="profile-success-message">{uploadSuccess}</div>}

      <div className="profile-banner">
        <div className="profile-header">
          <div className="profile-picture-wrapper">
            <img
              src={picture || "/default-profile.png"}
              alt="Profile"
              className="profile-picture"
            />
          </div>
          <label className="profile-picture-upload-button">
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {uploadLoading ? 'Uploading...' : 'Upload Picture'}
          </label>
        </div>
        <div className="profile-name-section">
          {isEditingName ? (
            <div className="profile-name-edit-container">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="profile-name-input"
              />
              <button onClick={handleUpdateName} className="profile-name-confirm-button">
                <FaCheck />
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="profile-name-cancel-button"
              >
                <FaTimes />
              </button>
            </div>
          ) : (
            <div className="profile-name-display">
              <h1 className="profile-name">
                {userAttributes?.preferred_username || 'User'}
              </h1>
              <button onClick={() => setIsEditingName(true)} className="profile-name-edit-button">
                <FaEdit />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-info-section">
        <div className="profile-info-item">
          <FaEnvelope className="profile-info-icon" />
          <div className="profile-info-text">
            <strong>Email:</strong>
            <span>{userAttributes?.email || 'Not provided'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
