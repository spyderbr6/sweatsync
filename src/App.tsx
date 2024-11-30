import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { uploadData } from 'aws-amplify/storage';
import { useAuthenticator } from '@aws-amplify/ui-react';



const client = generateClient<Schema>();

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Schema["PostforWorkout"]["type"]>>([]);
  const [content, setContent] = useState<string>(""); // Stores the post content
  const [file, setFile] = useState<File | undefined>(); // Stores the selected file
  const [imageUrls, setImageUrls] = useState<{[key: string]: string}>({}); // Stores image URLs for each post


  useEffect(() => {
    client.models.PostforWorkout.observeQuery().subscribe({
      next: (data) => setworkoutposts([...data.items]),
    });
  }, []);

  function createTodo() {
    if (content && file) {
      try {

        uploadData({
          path: `picture-submissions/${file.name}`,
          data: file,
        })

        client.models.PostforWorkout.create({ content });
      } catch (error) {
        console.error("Error Creating Post");

      }
    }
  }

  const handleContentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setContent(event.target.value);
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Set the selected file when a new file is chosen
    const selectedFile = event.target.files?.[0];
    setFile(selectedFile);
  };

  return (
    <main>
      <h1>My Workouts</h1>
      <input 
          type="text" 
          value={content}
          onChange={handleContentChange}
          placeholder="How did your workout go?"
        />
         <input 
          type="file" 
          onChange={handleFileChange} 
          accept="image/*"
        />

      <button onClick={createTodo}>Create Post</button>
      <ul>
        {workoutposts.map((PostforWorkout) => (
          <li key={PostforWorkout.id}>{PostforWorkout.content}{PostforWorkout.url && imageUrls[PostforWorkout.id] && (
            <img 
              src={imageUrls[PostforWorkout.id]} 
              alt="Post workout visual" 
              style={{ maxWidth: '200px', maxHeight: '200px' }} 
            />
          )}</li>
        ))}
      </ul>

    </main>
  );
}

export default App;
