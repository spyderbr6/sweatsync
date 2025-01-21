import React, { createContext, useContext, useState } from 'react';

interface PostCreationContextType {
  isPostModalOpen: boolean;
  openPostModal: () => void;
  closePostModal: () => void;
}

const PostCreationContext = createContext<PostCreationContextType | undefined>(undefined);

export function PostCreationProvider({ children }: { children: React.ReactNode }) {
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const openPostModal = () => {
    setIsPostModalOpen(true);
  };

  const closePostModal = () => {
    setIsPostModalOpen(false);
  };

  return (
    <PostCreationContext.Provider 
      value={{ 
        isPostModalOpen, 
        openPostModal, 
        closePostModal 
      }}
    >
      {children}
      <CreatePostModal 
        isOpen={isPostModalOpen}
        onClose={closePostModal}
      />
    </PostCreationContext.Provider>
  );
}

// Custom hook for using the context
export function usePostCreation() {
  const context = useContext(PostCreationContext);
  if (context === undefined) {
    throw new Error('usePostCreation must be used within a PostCreationProvider');
  }
  return context;
}

// Import at the top
import { CreatePostModal } from './CreatePostModal';