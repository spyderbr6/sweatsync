import { useEffect, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquarePlus, LogOut, User, Users, Trophy } from 'lucide-react';
import { CreatePostModal } from './CreatePostModal';
import { useUser } from './userContext';
import { useUrlCache } from './urlCacheContext';
import ChallengeFeedHeader from './challengeFeedHeader';
import FeedbackModal from './components/FeedbackModal/feedbackModal';
import NotificationBell from './components/NotificationBell/NotificationBell';


function Header() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const { signOut } = useAuthenticator();
  const { userAttributes, userId } = useUser();  // Add userId here
  const { getStorageUrl } = useUrlCache();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>("/profileDefault.png");
  const { pictureUrl } = useUser();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.querySelector(".dropdown");
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  if (userAttributes?.picture && profilePictureUrl === "/profileDefault.png") {
    getStorageUrl(userAttributes.picture)
      .then(url => setProfilePictureUrl(url))
      .catch(error => {
        console.error('Error loading profile picture:', error);
        setProfilePictureUrl("/profileDefault.png");
      });
  }

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
            />
          </div>
          <div className="header-actions">
            {/* Add NotificationBell before the account icon */}
            <div className="header-notifications">
              {userId && <NotificationBell userId={userId} />}
            </div>
            <div className="account-icon">
              <div className="dropdown">
                <img
                  src={pictureUrl || "profileDefault.png"}
                  alt={userAttributes?.preferred_username || "Account"}
                  className="dropdown-toggle"
                  onClick={() => setShowDropdown(!showDropdown)}
                />
                <div className={`dropdown-menu ${showDropdown ? 'show' : ''}`}>
                  <button className="dropdown-item" onClick={() => { navigate('/profile'); setShowDropdown(false); }}>
                    <User size={20} style={{ marginRight: '8px' }} />
                    Profile
                  </button>
                  <button className="dropdown-item" onClick={() => { navigate('/friends'); setShowDropdown(false); }}>
                    <Users size={20} style={{ marginRight: '8px' }} />
                    Friends
                  </button>
                  <button className="dropdown-item" onClick={() => { navigate('/Challenges'); setShowDropdown(false); }}>
                    <Trophy size={20} style={{ marginRight: '8px' }} />
                    Challenges
                  </button>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="dropdown-item"
                  >
                    <MessageSquarePlus size={20} style={{ marginRight: '8px' }} />
                    Send Feedback
                  </button>
                  <button className="dropdown-item" onClick={signOut}>
                    <LogOut size={20} style={{ marginRight: '8px' }} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <ChallengeFeedHeader />

      {/* Floating Action Button */}
      <button
        onClick={() => setIsPostModalOpen(true)}
        className="fab-button"
        aria-label="Create new post"
      >
        <Plus />
      </button>

      {/* Modals */}
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