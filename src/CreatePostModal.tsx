import { useNavigate } from 'react-router-dom';
import { X as CloseIcon } from 'lucide-react';
import PostCreator from './postCreator';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSuccess = () => {
    onClose();
    navigate('/');
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    // Prevent closing the modal if clicking on the modal itself
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modalStyles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
    },
    content: {
      position: 'relative' as const,
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '90%',
      width: '600px',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    },
    closeButton: {
      position: 'absolute' as const,
      top: '10px',
      right: '10px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '50%',
      color: '#666',
      transition: 'background-color 0.2s',
      zIndex: 1,
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={handleOverlayClick}>
      <div style={modalStyles.content}>
        <button 
          onClick={onClose}
          style={modalStyles.closeButton}
          aria-label="Close"
        >
          <CloseIcon size={24} />
        </button>
        <div>
          <PostCreator 
            onSuccess={handleSuccess}
            onError={(error) => console.error('Post creation failed:', error)} 
          />
        </div>
      </div>
    </div>
  );
}