import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import ProfilePage from "./profile.tsx";
import FriendsPage from "./friendManagement.tsx";
import Header from "./Header.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';


Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator components={{ Header: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}><img src="sweatsync_logo.gif" alt="Logo" style={{ width: '200px', height: 'auto' }} /></div> }}
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
       <Router>
        <Header/>
        <Routes>
          <Route path="/" element={<App/>} />
          <Route path="/profile" element={<ProfilePage/>} />
          <Route path="/friendManagement" element={<FriendsPage/>} />
        </Routes>
    </Router>
    </Authenticator>
  </React.StrictMode>
);
