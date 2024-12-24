import { useEffect, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { CreatePostModal } from './CreatePostModal';
import { useUser } from './userContext';
import { useUrlCache } from './urlCacheContext';
import ChallengeFeedHeader from './challengeFeedHeader';

function Header() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const { signOut } = useAuthenticator();
  const { userAttributes } = useUser();
  const { getStorageUrl } = useUrlCache();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>("/profileDefault.png");
  const { pictureUrl } = useUser();  // Add this

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
          <div className="account-icon">
            <div className="dropdown">
              <img
             src={pictureUrl || "profileDefault.png"} 
                alt={userAttributes?.preferred_username || "Account"}
                className="dropdown-toggle"
                onClick={() => setShowDropdown(!showDropdown)}
              />
              <div className={`dropdown-menu ${showDropdown ? 'show' : ''}`}>
                <button className="dropdown-item" onClick={() => {navigate('/profile'); setShowDropdown(false);}}>Profile</button>
                <button className="dropdown-item" onClick={() => {navigate('/friends');setShowDropdown(false);}}>Friends</button>
                <button className="dropdown-item" onClick={() => {navigate('/Challenges'); setShowDropdown(false);}}>Challenges</button>
                <button className="dropdown-item" onClick={signOut}>Logout</button>
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

      {/* Using existing CreatePostModal component */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />
    </>
  );
}

export default Header;