// userContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  getCurrentUser,
  FetchUserAttributesOutput, 
  fetchUserAttributes 
} from 'aws-amplify/auth';

interface UserContextType {
  userId: string | null;
  username: string | null;
  userAttributes: FetchUserAttributesOutput | null;
  isLoading: boolean;
  error: Error | null;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
    refreshUserData: fetchUserData
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