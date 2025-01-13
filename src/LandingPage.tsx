import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './LandingPage.css';
import IOSInstruction from './components/OnboardingFlow/IOSInstructions';

const LandingPage = () => {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const navigate = useNavigate();

  // Check if the user is on iOS and in browser
  const isIOSBrowser = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Check if the app is running as a PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone);
    
    return isIOS && !isStandalone;
  };

  const handleGetStarted = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    if (isIOSBrowser()) {
      setShowIOSPrompt(true);
    } else {
      navigate('/login');
    }
  };

  const handleIOSClose = () => {
    setShowIOSPrompt(false);
    navigate('/login');
  };

  return (
    <div className="landing-container">
      {/* Background with overlay */}
      <div 
        className="landing-background"
        style={{ backgroundImage: 'url("/workout-background.jpg")' }}
        aria-hidden="true"
      />
      
      {/* Content */}
      <div className="landing-content">
        <div className="landing-header">
          <img 
            src="/logo.png" 
            alt="SweatSync Logo"
            className="landing-logo"
          />
        </div>
        <h1>Challenge Friends. Push Limits. Win Together.</h1>

        <div className="landing-cta">
          <a href="/login" 
             className="landing-button"
             onClick={handleGetStarted}>
            Get Started
          </a>
        </div>

        <div className="landing-main">
          <h2>Transform Your Fitness Journey with Friends</h2>
          <p>Join SweatSync to track workouts, challenge friends, and build a 
            community that keeps you motivated, all with the power of AI</p>          
          <div className="landing-features">
            <div className="feature-item">
              <span>✓</span>
              <p>Create and join fitness challenges with friends</p>
            </div>
            <div className="feature-item">
              <span>✓</span>
              <p>Share your workout progress & achievements</p>
            </div>
            <div className="feature-item">
              <span>✓</span>
              <p>Get motivated with community support</p>
            </div>
          </div>
        </div>

        <div className="landing-footer">
          <p>© 2024 SweatSync. All rights reserved.</p>
        </div>
      </div>

      {showIOSPrompt && <IOSInstruction onClose={handleIOSClose} />}
    </div>
  );
};

export default LandingPage;