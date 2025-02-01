import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './userContext';
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
import { OnboardingFlow } from './components/OnboardingFlow/OnboardingFlow';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import BottomNav from "./components/BottomNav/BottomNav";
import { PostCreationProvider } from "./postCreationContext.tsx";
import { PersonalStatsPage } from "./components/PersonalStats/PersonalStats.tsx";


Amplify.configure(outputs);


function AuthenticatedApp() {
  //const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { hasCompletedOnboarding, isLoading } = useUser();
  const { updateAvailable, forceUpdate, newWorker } = useServiceWorkerUpdate();

  if (isLoading) {
    return null;
  }

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <OnboardingFlow />;
  }

  const handleUpdate = () => {
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return (

    <DataVersionProvider>
      <PostCreationProvider>
        <main className="main-content">
          <Header updateAvailable={updateAvailable} onUpdate={forceUpdate} />
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/Challenges" element={<ChallengesPage />} />
            <Route path="/challenge/:challengeId" element={<ChallengeDetailPage />} />
            <Route path="/post/:postId" element={<SinglePostPage />} />
            <Route path="/health" element={<PersonalStatsPage/>} />
          </Routes>
          <BottomNav />
          {updateAvailable && <UpdateNotification onUpdate={handleUpdate} />}
        </main>
      </PostCreationProvider>

    </DataVersionProvider>

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
          signUpAttributes={['preferred_username', 'phone_number']}
          components={{
            Header() {
              return (
                <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem', background: 'rgba(255, 255, 255)' }}>
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
              phone_number: {
                label: 'Phone Number',
                isRequired: true,
                dialCode: '+1',
                placeholder: 'Enter your phone number',
                order: 2
              }
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
  const { authStatus } = useAuthenticator(context => [
    context.authStatus
    //context.user
  ]);

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  // Handle initial load
  useEffect(() => {
    if (authStatus !== 'configuring') {
      setIsLoading(false);
    }
  }, [authStatus]);

  // Show nothing while loading to prevent flash
  if (isLoading) {
    return null;
  }

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
        <UrlCacheProvider>
          <UserProvider>
            <AuthenticatedRoutes />
          </UserProvider>
        </UrlCacheProvider>
      </Authenticator.Provider>
    </Router>
  );
}



ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);