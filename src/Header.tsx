import { useEffect, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate} from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const {signOut } = useAuthenticator();

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

  
  return (
    <main className="main-container">
      <div className="header-input-container">
        <div className="header-container">
          <img src="/sweatsync_logo.gif" alt="SweatSync Logo" className="logo" onClick={() => navigate('/')} />
        </div>
        <div className="account-icon">
          <div className="dropdown">
          <img src="profileDefault.png" alt="Account" className="dropdown-toggle" onClick={() => setShowDropdown(!showDropdown)} />
          <div className={`dropdown-menu ${showDropdown ? 'show' : ''}`}>
            <button className="dropdown-item" onClick={() => navigate('/')}>Home</button>
              <button className="dropdown-item" onClick={() => navigate('/profile')}>Profile</button>
              <button className="dropdown-item" onClick={() => navigate('/friendManagement')}>Friends</button>
              <button className="dropdown-item" onClick={() => navigate('/Challenges')}>Challenges</button>
              <button className="dropdown-item" onClick={signOut}>Logout</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
