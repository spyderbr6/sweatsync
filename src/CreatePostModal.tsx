import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X as CloseIcon, Check } from 'lucide-react';
import PostCreator from './postCreator';
import styles from './CreatePostModal.module.css';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSuccess = () => {
    setShowSuccess(true);

    // Show success message for 2 seconds, then close and navigate
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
      navigate('/');
    }, 2000);
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    // Prevent closing the modal if clicking on the modal itself or if showing success
    if (event.target === event.currentTarget && !showSuccess) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.content}>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close"
          disabled={showSuccess}
        >
          <CloseIcon size={24} />
        </button>

        {showSuccess && (
          <div className={styles.successOverlay}>
            <div className={styles.successIcon}>
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className={styles.successTitle}>Posted Successfully!</h3>
            <p className={styles.successMessage}>Redirecting to feed...</p>
          </div>
        )}

        <div style={{ opacity: showSuccess ? 0 : 1, transition: 'opacity 0.3s ease' }}>
          <PostCreator
            onSuccess={handleSuccess}
            onError={(error) => console.error('Post creation failed:', error)}
          />
        </div>
      </div>
    </div>
  );
}