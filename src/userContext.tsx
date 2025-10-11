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
  const [retryCount, setRetryCount] = useState(0);
  const { getStorageUrl } = useUrlCache();

  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const fetchUserData = async (retry = 0): Promise<void> => {
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
          console.error('Error getting picture URLs:', urlError);
          setProfilePicture('/profileDefault.png');
          setProfileThumbnail('/profileDefault.png');
        }
      } else {
        setProfilePicture('/profileDefault.png');
        setProfileThumbnail('/profileDefault.png');
      }

      // Reset retry count on success
      setRetryCount(0);

    } catch (err) {
      console.error(`Error in fetchUserData (attempt ${retry + 1}/${MAX_RETRIES + 1}):`, err);

      // Retry logic for transient errors
      if (retry < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        setRetryCount(retry + 1);
        setTimeout(() => {
          fetchUserData(retry + 1);
        }, RETRY_DELAY);
        return;
      }

      // Only set error and defaults after all retries exhausted
      setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
      setProfilePicture('/profileDefault.png');
      setProfileThumbnail('/profileDefault.png');
      // Don't reset hasCompletedOnboarding on error - preserve it
    } finally {
      // Only set loading to false if we're not going to retry
      if (retry >= MAX_RETRIES) {
        setIsLoading(false);
        setRetryCount(0);
      } else if (retry === 0) {
        setIsLoading(false);
      }
    }
  };

  // Update useEffect to depend on auth status
  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchUserData();
    } else if (authStatus === 'unauthenticated') {
      // Only reset states when explicitly unauthenticated (logged out)
      // Don't reset during 'configuring' state to avoid premature resets
      setUserId(null);
      setUsername(null);
      setUserAttributes(null);
      setProfilePicture('/profileDefault.png');
      setProfileThumbnail('/profileDefault.png');
      setHasCompletedOnboarding(null);
      setIsLoading(false);
    }
    // For 'configuring' state, do nothing - preserve existing state
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