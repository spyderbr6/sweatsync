import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css';

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator components={{ Header: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}><img src="sweatsync_logo.gif" alt="Logo" style={{ width: '200px', height: 'auto' }} /></div> }}
      signUpAttributes={['preferred_username']}>
      <App />
    </Authenticator>
  </React.StrictMode>
);
