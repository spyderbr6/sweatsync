import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../userContext';
import { useProfilePictureUploader } from '../../utils/profilePictureUploader';
import { NotificationPreferences } from '../notificationPreferences/notificationPreferences';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../../amplify/data/resource';
import './OnboardingFlow.css';

type Step = 'welcome' | 'profile' | 'notifications';

const client = generateClient<Schema>();

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const { userId, picture, refreshUserData } = useUser();
  const {
    uploadProfilePicture,
    loading: uploadLoading,
    error: uploadError,
  } = useProfilePictureUploader();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && userId) {
      setIsUploading(true);
      await uploadProfilePicture(e.target.files[0], userId, async () => {
        await refreshUserData();
        setIsUploading(false);
      });
    }
  };

  // Separate check for whether we can proceed from the profile step
  const canProceedFromProfile = picture && picture !== '/profileDefault.png';

  const completeOnboarding = async () => {
    if (!userId) return;

    try {
      // Update user's onboarding status
      await client.models.User.update({
        id: userId,
        hasCompletedOnboarding: true,
        updatedAt: new Date().toISOString()
      });

      await refreshUserData();

      // Navigate to main app
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="onboarding-step">
            <h1 className="onboarding-title">Welcome to SweatSync!</h1>
            <p className="onboarding-description">
              Let's get your profile set up so you can start connecting with friends
              and tracking your fitness journey.
            </p>
            <button 
              className="onboarding-button"
              onClick={() => setCurrentStep('profile')}
            >
              Get Started
            </button>
          </div>
        );

      case 'profile':
        return (
          <div className="onboarding-step">
            <h2 className="onboarding-title">Add a Profile Picture</h2>
            <p className="onboarding-description">
              Help others recognize you by adding a profile picture.
            </p>
            <div className="onboarding-profile-picture-section">
              <div className="onboarding-profile-picture-wrapper">
                <img
                  src={picture || "/profileDefault.png"}
                  alt="Profile"
                  className="onboarding-profile-image"
                />
              </div>
              <label className="onboarding-upload-button">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {isUploading ? 'Uploading...' : 'Choose Photo'}
              </label>
            </div>
            {uploadError && <p className="error-message">{uploadError}</p>}
            {canProceedFromProfile && (
              <button 
                className="onboarding-button"
                onClick={() => setCurrentStep('notifications')}
              >
                Continue
              </button>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="onboarding-step">
            <h2 className="onboarding-title">Enable Notifications</h2>
            <p className="onboarding-description">
              Stay updated with your fitness challenges and friend activities.
            </p>
            <NotificationPreferences />
            <button 
              className="onboarding-button"
              onClick={completeOnboarding}
            >
              Complete Setup
            </button>
          </div>
        );
    }
  };

  const renderProgressDots = () => {
    const steps: Step[] = ['welcome', 'profile', 'notifications'];
    return (
      <div className="onboarding-progress">
        {steps.map((step) => (
          <div 
            key={step}
            className={`progress-dot ${currentStep === step ? 'active' : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <img src="/logo.png" alt="SweatSync Logo" />
      </div>
      <div className="onboarding-content">
        {renderProgressDots()}
        {renderStep()}
      </div>
    </div>
  );
}