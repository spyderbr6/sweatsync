import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
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

        <div className="landing-main">
          <h1>Transform Your Fitness Journey with Friends</h1>
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

          <div className="landing-cta">
            <Link to="/login" className="landing-button">
              Get Started
            </Link>
          </div>
        </div>

        <div className="landing-footer">
          <p>© 2024 SweatSync. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;