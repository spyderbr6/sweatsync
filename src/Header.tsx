import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { uploadData } from 'aws-amplify/storage';
//import './App.css'; // Import external CSS file
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate} from 'react-router-dom';
import { 
    FetchUserAttributesOutput, 
    fetchUserAttributes 
  } from "aws-amplify/auth";


const client = generateClient<Schema>();

function App() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [content, setContent] = useState<string>(""); // Stores the post content
  const [file, setFile] = useState<File | undefined>(); // Stores the selected file
  const [loading, setLoading] = useState<boolean>(false); // Tracks loading state
  const { user, signOut } = useAuthenticator();
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);

  const handleContentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setContent(event.target.value); //capture user message input
  };

  //On click, selects file for upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };
  useEffect(() => {
    if (file) {
      createPost();
    }
  }, [file]);
// end file change handling

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

  useEffect(() => {
    const getUserAttributes = async () => {
      try {
        setLoading(true);
        const attributes = await fetchUserAttributes();
        setUserAttributes(attributes);
      } catch (error) {
        console.error('Unexpected error fetching user attributes:', error);
      } finally {
        setLoading(false);
      }
    };
    getUserAttributes();
  }, []);

  async function createPost() {
    if (content && file && user) {
      setLoading(true);
      try {
        // Upload file to storage
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const path = `picture-submissions/${uniqueFileName}`;
        await uploadData({ path, data: file });

        // Create post
        await client.models.PostforWorkout.create({ content, url: path, username: userAttributes?.preferred_username, thumbsUp: 0, smiley: 0, trophy: 0 });

        // Clear input fields
        setContent("");
        setFile(undefined);
      } catch (error) {
        console.error("Error Creating Post", error);
        alert("Failed to create the post. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      alert("Please provide content and select a file.");
    }
  }

  
  
  return (
    <main className="main-container">
      <div className="header-input-container">
        <div className="header-container">
          <img src="/sweatsync_logo.gif" alt="SweatSync Logo" className="logo" onClick={() => navigate('/')} />
        </div>
        <div className="input-container">
          <input
            type="text"
            value={content}
            onChange={handleContentChange}
            placeholder={`${userAttributes?.preferred_username || 'User'}, how did your workout go?`}

            className="text-input"
          />
          <label htmlFor="file-upload" className="file-upload-label">
            <img src="/upload_icon.png" alt="Upload" className="file-upload-icon" />
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            className="file-input"
            disabled={loading}
          />

        </div>
        <div className="account-icon">
          <div className="dropdown">
          <img src="/menu.png" alt="Account" className="dropdown-toggle" onClick={() => setShowDropdown(!showDropdown)} />
          <div className={`dropdown-menu ${showDropdown ? 'show' : ''}`}>
            <button className="dropdown-item" onClick={() => navigate('/')}>Home</button>
              <button className="dropdown-item" onClick={() => navigate('/profile')}>Profile</button>
              <button className="dropdown-item" onClick={signOut}>Logout</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
