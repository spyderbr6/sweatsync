import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from 'aws-amplify/storage';
//import './App.css'; // Import external CSS file
//import { useAuthenticator } from '@aws-amplify/ui-react';
//import { FileUploader } from '@aws-amplify/ui-react-storage';
//import { StorageImage } from '@aws-amplify/ui-react-storage';


const client = generateClient<Schema>();

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Schema["PostforWorkout"]["type"]>>([]);
  const [content, setContent] = useState<string>(""); // Stores the post content
  const [file, setFile] = useState<File | undefined>(); // Stores the selected file
  const [imageUrls,setImageUrls] = useState<{ [key: string]: string }>({}); // Stores image URLs for each post
  const [loading, setLoading] = useState<boolean>(false); // Tracks loading state

  const handleContentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setContent(event.target.value); //capture user message input
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Set the selected file when a new file is chosen
    const selectedFile = event.target.files?.[0];
    setFile(selectedFile);
  };

  useEffect(() => {
    const subscription = client.models.PostforWorkout.observeQuery().subscribe({
      next: async (data) => {
        setworkoutposts([...data.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        const urls: { [key: string]: string } = {};
        for (const item of data.items) {
          if (item.url) {
            const linkToStorageFile = await getUrl({ path: item.url });
            urls[item.id] = linkToStorageFile.url.toString();
          }
        }
        setImageUrls(urls);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  async function createPost() {
    if (content && file) {
      setLoading(true);
      try {
        // Upload file to storage
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const path = `picture-submissions/${uniqueFileName}`;
        await uploadData({ path, data: file });

        // Create post
        await client.models.PostforWorkout.create({ content, url: path });

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

  function deletePost(id: string) {
    if (window.confirm("Are you sure you want to delete this post?")) {
      client.models.PostforWorkout.delete({ id }).catch((error) => {
        console.error("Error Deleting Post", error);
        alert("Failed to delete the post. Please try again.");
      });
    }
  }

  return (
    <main className="main-container">
    <div className="header-input-container">
      <div className="header-container">
        <img src="/sweatsync_logo.gif" alt="SweatSync Logo" className="logo" />
      </div>
      <div className="input-container">
      <input 
        type="text" 
        value={content}
        onChange={handleContentChange}
        placeholder="How did your workout go?"
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
      />
      <button
        onClick={createPost}
        className="create-button"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Post"}
      </button>
    </div>
  
      <div className="account-icon">
        <img src="/menu.png" alt="Account" />
      </div>
    </div>

    <div className="posts-container" style={{ paddingTop: '100px' }}>
      {workoutposts.map((PostforWorkout) => (
        <div key={PostforWorkout.id} className="post-card">
          <button
            onClick={() => deletePost(PostforWorkout.id)}
            className="delete-button"
          >
            ✕
          </button>
          <img
            src={imageUrls[PostforWorkout.id] || "/picsoritdidnthappen.webp"}
            alt="Post workout visual"
            className="post-image"
          />
          <div>
            <p className="post-content">
              {PostforWorkout.content}
            </p>
            <small className="post-date">
              Created at: {new Date(PostforWorkout.createdAt).toLocaleString()}
            </small>
          </div>
        </div>
      ))}
    </div>
  </main>
  );
}

export default App;
