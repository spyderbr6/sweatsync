import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { UserProvider } from './userContext';
import { DataVersionProvider } from './dataVersionContext';
import App from "./App.tsx";
import ProfilePage from "./profile.tsx";
import FriendsPage from "./friendManagement.tsx";
import ChallengesPage from "./Challenges.tsx";
import ChallengeDetailPage from "./challengeDetailPage.tsx";
import Header from "./Header.tsx";
import SinglePostPage from "./SinglePagePost.tsx";
import LandingPage from "./LandingPage";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { UrlCacheProvider } from './urlCacheContext';
import UpdateNotification from './components/UpdateNotification/UpdateNotification';

Amplify.configure(outputs);

let newWorker: ServiceWorker | null = null;


// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // First check if there's an existing registration
    navigator.serviceWorker.getRegistration().then(existingRegistration => {
      if (existingRegistration) {
        console.log('Found existing service worker:', existingRegistration);
        
        // Check if there's a waiting worker
        if (existingRegistration.waiting) {
          console.log('New version waiting to activate');
          newWorker = existingRegistration.waiting;
          window.dispatchEvent(new Event('swUpdateAvailable'));
        }

        existingRegistration.addEventListener('updatefound', () => {
          console.log('Update found for service worker');
          const installingWorker = existingRegistration.installing;
          
          if (installingWorker) {
            newWorker = installingWorker;
            installingWorker.addEventListener('statechange', () => {
              console.log('Service worker state changed:', installingWorker.state);
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New content available, showing update notification');
                window.dispatchEvent(new Event('swUpdateAvailable'));
              }
            });
          }
        });

      } else {
        // Only register if there's no existing registration
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('SW registered:', registration);
          
          registration.addEventListener('updatefound', () => {
            // Same update found logic as above
            console.log('Update found for service worker');
            const installingWorker = registration.installing;
            
            if (installingWorker) {
              newWorker = installingWorker;
              installingWorker.addEventListener('statechange', () => {
                console.log('Service worker state changed:', installingWorker.state);
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content available, showing update notification');
                  window.dispatchEvent(new Event('swUpdateAvailable'));
                }
              });
            }
          });
        }).catch(error => {
          console.error('SW registration failed:', error);
        });
      }

      // Add reload control (outside the if/else since we want this either way)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          console.log('New service worker activated, reloading page');
          refreshing = true;
          window.location.reload();
        }
      });
    });
  });
}

function AuthenticatedApp() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  React.useEffect(() => {
    const handleUpdateAvailable = () => setShowUpdateModal(true);
    window.addEventListener('swUpdateAvailable', handleUpdateAvailable);
    return () => window.removeEventListener('swUpdateAvailable', handleUpdateAvailable);
  }, []);

  const handleUpdate = () => {
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return (
    <UrlCacheProvider>
      <UserProvider>
        <DataVersionProvider>
          <>
            <Header />
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/Challenges" element={<ChallengesPage />} />
              <Route path="/challenge/:challengeId" element={<ChallengeDetailPage />} />
              <Route path="/post/:postId" element={<SinglePostPage />} />
            </Routes>
            {showUpdateModal && <UpdateNotification onUpdate={handleUpdate} />}
          </>
        </DataVersionProvider>
      </UserProvider>
    </UrlCacheProvider>
  );
}

function LoginPage() {
  return (
    <div className="login-container">
      <div 
        className="login-background"
        style={{ backgroundImage: 'url("/workout-background.jpg")' }}
        aria-hidden="true"
      />
      <div className="login-form-container">
        <Authenticator
          signUpAttributes={['preferred_username']}
          components={{
            Header() {
              return (
                <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem',   background: 'rgba(255, 255, 255)' }}>
                  <img 
                    src="/logo.png" 
                    alt="SweatSync Logo" 
                    style={{ 
                      height: '50px', 
                      width: 'auto',
                      marginBottom: '1rem'            
                    }} 
                  />
                </div>
              );
            },
          }}
          formFields={{
            signUp: {
              preferred_username: {
                label: 'Preferred Username',
                isRequired: true,
                placeholder: 'Enter your preferred username',
                order: 1
              },
            },
          }}
        >
           <Navigate to="/" replace />
        </Authenticator>
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/*" 
        element={
          authStatus === 'authenticated' 
            ? <AuthenticatedApp /> 
            : <LandingPage />
        } 
      />
    </Routes>
  );
}

function AppWrapper() {
  return (
    <Router>
      <Authenticator.Provider>
        <AuthenticatedRoutes />
      </Authenticator.Provider>
    </Router>
  );
}



ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);