// userContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getCurrentUser,
  FetchUserAttributesOutput,
  fetchUserAttributes
} from 'aws-amplify/auth';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUrlCache } from './urlCacheContext';  // Add this at the top
import { useAuthenticator } from '@aws-amplify/ui-react';


interface UserContextType {
  userId: string | null;
  username: string | null;
  userAttributes: FetchUserAttributesOutput | null;
  isLoading: boolean;
  error: Error | null;
  refreshUserData: () => Promise<void>;
  picture: string | null; // Full picture
  pictureUrl: string | null; //Thumbnail
  hasCompletedOnboarding: boolean | null;  // first time check
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [picture, setProfilePicture] = useState<string | null>(null);
  const [pictureUrl, setProfileThumbnail] = useState<string | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const { getStorageUrl } = useUrlCache();

  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Only proceed if properly authenticated
      if (authStatus !== 'authenticated') {
        console.log('Waiting for authentication...');
        setIsLoading(false);
        return;
      }

      const [user, attributes] = await Promise.all([
        getCurrentUser(),
        fetchUserAttributes()
      ]);

      if (!user?.userId) {
        throw new Error('No user ID available');
      }

      setUserId(user.userId);
      setUsername(user.username);
      setUserAttributes(attributes);

      // Get user data from database
      const client = generateClient<Schema>();
      const userResult = await client.models.User.get({ id: user.userId });

      if (!userResult?.data) {
        // If no user data, sync it first
        await syncUserToDatabase({
          userId: user.userId,
          username: user.username,
          attributes: attributes
        });
        // Fetch again after sync
        const refreshedUser = await client.models.User.get({ id: user.userId });
        setHasCompletedOnboarding(refreshedUser.data?.hasCompletedOnboarding ?? false);
      } else {
        setHasCompletedOnboarding(userResult.data.hasCompletedOnboarding ?? false);
      }

      if (userResult?.data?.picture) {
        try {
          const originalPath = userResult.data.picture;
          const thumbnailPath = userResult.data.pictureUrl ?? originalPath;

          const [originalUrl, thumbnailUrl] = await Promise.all([
            getStorageUrl(originalPath),
            getStorageUrl(thumbnailPath)
          ]);

          setProfilePicture(originalUrl);
          setProfileThumbnail(thumbnailUrl);
        } catch (urlError) {
          console.error('8A. Error getting picture URLs:', urlError);
          setProfilePicture('/profileDefault.png');
          setProfileThumbnail('/profileDefault.png');
        }
      } else {
        setProfilePicture('/profileDefault.png');
        setProfileThumbnail('/profileDefault.png');
      }

    } catch (err) {
      console.error('Error in fetchUserData:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
      setProfilePicture('/profileDefault.png');
      setProfileThumbnail('/profileDefault.png');
    } finally {
      setIsLoading(false);
    }
  };

  // Update useEffect to depend on auth status
  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchUserData();
    } else {
      // Reset states when not authenticated
      setUserId(null);
      setUsername(null);
      setUserAttributes(null);
      setProfilePicture('/profileDefault.png');
      setProfileThumbnail('/profileDefault.png');
      setHasCompletedOnboarding(null);
    }
  }, [authStatus]);

  const value = {
    userId,
    username,
    userAttributes,
    isLoading,
    error,
    refreshUserData: fetchUserData,
    picture,
    pictureUrl,
    hasCompletedOnboarding
  };




  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// Custom hook for using the user context
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

async function syncUserToDatabase(cognitoUser: {
  userId: string;
  username: string;
  attributes: FetchUserAttributesOutput;
}) {
  const client = generateClient<Schema>();

  try {
    // Check if user already exists in our table
    const response = await client.models.User.get({ id: cognitoUser.userId });

    const userData = {
      id: cognitoUser.userId,
      email: cognitoUser.attributes.email || '',
      username: cognitoUser.username,
      preferred_username: cognitoUser.attributes.preferred_username || '',
      lowercasename: (cognitoUser.attributes.preferred_username || '').toLowerCase(),
      updatedAt: new Date().toISOString(),
    };

    // Changed this condition to check response.data
    if (!response?.data) {
      // Create new user
      await client.models.User.create({
        ...userData,
        createdAt: new Date().toISOString(),
      });
    } else {
      // Update existing user
      await client.models.User.update({
        ...userData,
      });
    }
  } catch (error) {
    console.error('Error syncing user to database:', error);
    throw error;
  }
}