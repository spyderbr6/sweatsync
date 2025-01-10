import { useEffect, useState, useRef } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquarePlus, LogOut, User, Users, Trophy, RefreshCw } from 'lucide-react';
import { CreatePostModal } from './CreatePostModal';
import { useUser } from './userContext';
import { useUrlCache } from './urlCacheContext';
import ChallengeFeedHeader from './challengeFeedHeader';
import FeedbackModal from './components/FeedbackModal/feedbackModal';
import NotificationBell from './components/NotificationBell/NotificationBell';

interface HeaderProps {
  updateAvailable?: boolean;
  onUpdate?: () => Promise<void>;
}

function Header({ updateAvailable, onUpdate }: HeaderProps) {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { signOut } = useAuthenticator();
  const { userAttributes, userId } = useUser();
  const { getStorageUrl } = useUrlCache();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>("/profileDefault.png");
  const { pictureUrl } = useUser();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  // Load profile picture
  useEffect(() => {
    if (userAttributes?.picture && profilePictureUrl === "/profileDefault.png") {
      getStorageUrl(userAttributes.picture)
        .then(url => setProfilePictureUrl(url))
        .catch(error => {
          console.error('Error loading profile picture:', error);
          setProfilePictureUrl("/profileDefault.png");
        });
    }
  }, [userAttributes?.picture, profilePictureUrl, getStorageUrl]);

  const menuItems = [
    {
      label: 'Profile',
      icon: <User size={20} />,
      onClick: () => navigate('/profile'),
      ariaLabel: 'Go to profile page'
    },
    {
      label: 'Friends',
      icon: <Users size={20} />,
      onClick: () => navigate('/friends'),
      ariaLabel: 'Go to friends page'
    },
    {
      label: 'Challenges',
      icon: <Trophy size={20} />,
      onClick: () => navigate('/Challenges'),
      ariaLabel: 'Go to challenges page'
    },
    {
      label: 'Send Feedback',
      icon: <MessageSquarePlus size={20} />,
      onClick: () => setShowFeedbackModal(true),
      ariaLabel: 'Open feedback form'
    }
  ];

      // Add update menu item if update is available
  if (updateAvailable && onUpdate) {
    menuItems.push({
      label: 'Update Available',
      icon: <RefreshCw size={20} />,
      onClick: () => onUpdate(),
      ariaLabel: 'Install updates'
    });
  }
  // Add logout as the last item
  menuItems.push({
    label: 'Logout',
    icon: <LogOut size={20} />,
    onClick: signOut,
    ariaLabel: 'Sign out of account'
  });
  

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
      setShowDropdown(false);
    }
  };

  return (
    <>
      <main className="main-container">
        <div className="header-input-container">
          <div className="header-container">
            <img
              src="/logo.png"
              alt="SweatSync Logo"
              className="logo"
              onClick={() => navigate('/')}
              onKeyDown={(e) => handleKeyDown(e, () => navigate('/'))}
              role="button"
              tabIndex={0}
            />
          </div>
          <div className="header-actions">

            <div className="header-notifications">
              {userId && <NotificationBell userId={userId} />}
            </div>
            <div className="account-menu" ref={dropdownRef}>
              <button
                ref={buttonRef}
                className="account-button"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-expanded={showDropdown}
                aria-haspopup="true"
                aria-controls="account-dropdown"
                aria-label="Account menu"
              >
                <img
                  src={pictureUrl || "/profileDefault.png"}
                  alt={`${userAttributes?.preferred_username || "User"}'s profile`}
                  className="account-image"
                />
              </button>

              <div
                id="account-dropdown"
                className={`dropdown-menu ${showDropdown ? 'show' : ''}`}
                role="menu"
                aria-labelledby="account-button"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    className="dropdown-item"
                    onClick={() => {
                      item.onClick();
                      setShowDropdown(false);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, item.onClick)}
                    role="menuitem"
                    tabIndex={showDropdown ? 0 : -1}
                    aria-label={item.ariaLabel}
                  >
                    {item.icon}
                    <span className="dropdown-item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ChallengeFeedHeader />

      <button
        onClick={() => setIsPostModalOpen(true)}
        className="fab-button"
        aria-label="Create new post"
      >
        <Plus />
      </button>

      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}

export default Header;