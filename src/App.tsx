import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { getUrl } from 'aws-amplify/storage';
//import './App.css'; // Import external CSS file

const useSpoofData = true;

const client = generateClient<Schema>();

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Schema["PostforWorkout"]["type"]>>([]);
  const [imageUrls,setImageUrls] = useState<{ [key: string]: string }>({}); // Stores image URLs for each post

  useEffect(() => {
    const subscription = client.models.PostforWorkout.observeQuery().subscribe({
      next: async (data) => {
        // Sort posts by createdAt desc
        const sortedPosts = [...data.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setworkoutposts(sortedPosts);

        if (useSpoofData) {
          // If we're spoofing data, set all image URLs to a local placeholder without calling S3
          const spoofedUrls: { [key: string]: string } = {};
          for (const item of data.items) {
            // Use a local placeholder image or any static URL
            spoofedUrls[item.id] = "/picsoritdidnthappen.webp";
          }
          setImageUrls(spoofedUrls);
        } else {
          // Normal behavior: get URLs from S3
          const urls: { [key: string]: string } = {};
          for (const item of data.items) {
            if (item.url) {
              const linkToStorageFile = await getUrl({ path: item.url });
              urls[item.id] = linkToStorageFile.url.toString();
            }
          }
          setImageUrls(urls);
        }
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  function deletePost(id: string) {
    if (window.confirm("Are you sure you want to delete this post?")) {
      client.models.PostforWorkout.delete({ id }).catch((error) => {
        console.error("Error Deleting Post", error);
        alert("Failed to delete the post. Please try again.");
      });
    }
  }
  
  async function reactToPost(id: string, reaction: "thumbsUp" | "smiley" | "trophy") {
    try {
      const response = await client.models.PostforWorkout.get({ id });
      const post = response?.data;

      if (post) {
        const updatedValue = (post[reaction] || 0) + 1;
        await client.models.PostforWorkout.update({ id, [reaction]: updatedValue });

        setworkoutposts((prevPosts) =>
          prevPosts.map((p) => (p.id === id ? { ...p, [reaction]: updatedValue } : p))
        );
      }
    } catch (error) {
      console.error("Error reacting to post", error);
    }
  }


  
  
  
  return (
    <main className="main-container">

      <div className="posts-container">
        {workoutposts.map((PostforWorkout) => (
          <div key={PostforWorkout.id} className="post-card">
            <button
              onClick={() => deletePost(PostforWorkout.id)}
              className="delete-button"
            >
              ✕
            </button>
            <div className="image-container">
              <img
                src={imageUrls[PostforWorkout.id] || "/picsoritdidnthappen.webp"}
                alt="Post workout visual"
                className="post-image"
              />
              <div className="reactions-container">
                <button onClick={() => reactToPost(PostforWorkout.id, "thumbsUp")}>👍 {PostforWorkout.thumbsUp || 0}</button>
                <button onClick={() => reactToPost(PostforWorkout.id, "smiley")}>😊 {PostforWorkout.smiley || 0}</button>
                <button onClick={() => reactToPost(PostforWorkout.id, "trophy")}>🏆 {PostforWorkout.trophy || 0}</button>
              </div>
            </div>
            <div>
              <p className="post-content">
                {PostforWorkout.content}
              </p>
              <small className="post-date">
                Created at: {new Date(PostforWorkout.createdAt).toLocaleString()} by: {PostforWorkout.username}
              </small>

            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
