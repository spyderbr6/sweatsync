import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator } from '@aws-amplify/ui-react';
import { UserProvider } from './userContext';
import { DataVersionProvider } from './dataVersionContext';
import App from "./App.tsx";
import ProfilePage from "./profile.tsx";
import FriendsPage from "./friendManagement.tsx";
import ChallengesPage from "./Challenges.tsx";
import ChallengeDetailPage from "./challengeDetailPage.tsx";
import Header from "./Header.tsx";
import SinglePostPage from "./SinglePagePost.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { UrlCacheProvider } from './urlCacheContext';


Amplify.configure(outputs);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator components={{ Header: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}><img src="../logo.png" alt="Logo" style={{ width: '200px', height: 'auto' }} /></div> }}
      signUpAttributes={['preferred_username']}
      formFields={{
        signUp: {
          preferred_username: {
            label: 'Preferred Username',
            isRequired: true,
            placeholder: 'Enter your preferred username',
            order: 1
          },
        },
      }}>
       <UrlCacheProvider>
        <UserProvider>
          <DataVersionProvider>  {/*currently suppressed due to refresh needs*/}
            <Router>
              <Header />
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/Challenges" element={<ChallengesPage />} />
                <Route path="/challenge/:challengeId" element={<ChallengeDetailPage />} />
                <Route path="/post/:postId" element={<SinglePostPage />} />
              </Routes>
            </Router>
          </DataVersionProvider>
        </UserProvider>
      </UrlCacheProvider>
    </Authenticator>
  </React.StrictMode>
);