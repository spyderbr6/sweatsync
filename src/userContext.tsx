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


interface UserContextType {
  userId: string | null;
  username: string | null;
  userAttributes: FetchUserAttributesOutput | null;
  isLoading: boolean;
  error: Error | null;
  refreshUserData: () => Promise<void>;
  picture: string | null; // Full picture
  pictureUrl: string | null; //Thumbnail
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

  const { getStorageUrl } = useUrlCache();


  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      setError(null);
  
      // Get current user
      const user = await getCurrentUser();
      setUserId(user.userId);
      setUsername(user.username);
  
      // Get user attributes
      const attributes = await fetchUserAttributes();
      setUserAttributes(attributes);
  
      // Get user data from our database
      const client = generateClient<Schema>();
      const userResult = await client.models.User.get({ id: user.userId });
      
      if (userResult.data?.picture) {
        // Construct paths using correct format
        const originalPath = userResult.data.picture;
        const thumbnailPath = userResult.data.pictureUrl ?? "";
  
        try {
          // Get URLs for both versions
          const originalUrl = await getStorageUrl(originalPath);
          const thumbnailUrl = await getStorageUrl(thumbnailPath);
          
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
  
      // Sync user data to database
      await syncUserToDatabase({
        userId: user.userId,
        username: user.username,
        attributes: attributes
      });
  
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
      console.error('Error fetching user data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const value = {
    userId,
    username,
    userAttributes,
    isLoading,
    error,
    refreshUserData: fetchUserData, 
    picture,
    pictureUrl
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