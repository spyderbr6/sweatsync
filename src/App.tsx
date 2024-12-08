import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { getUrl } from 'aws-amplify/storage';
import { Heart, MessageCircle, Share2, Camera, Trophy, Flame, Users } from 'lucide-react';

const useSpoofData = true;
const client = generateClient<Schema>();

type Post = Schema["PostforWorkout"]["type"] & {
  showReactions?: boolean;
  activeReactions?: Array<{ id: number; emoji: string }>;
};

type FloatingReactionProps = {
  emoji: string;
  onAnimationEnd: () => void;
};

type ReactionGridProps = {
  onReaction: (emoji: string) => void;
  visible: boolean;
};

type WorkoutPostProps = {
  post: Post;
  imageUrl: string;
  onReaction: (id: string, emoji: string | null, reactionId?: number) => void;
  onLike: (id: string, reaction: "thumbsUp" | "smiley" | "trophy") => void;
  onDelete: (id: string) => void;
  onHover: (id: string, isHovering: boolean) => void;
};

const CHEER_EMOJIS = [
  { emoji: "💪", label: "Strong" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "⚡", label: "Energy" },
  { emoji: "👊", label: "Fist Bump" },
  { emoji: "🎯", label: "Goal" },
  { emoji: "⭐", label: "Star" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "👏", label: "Applause" },
  { emoji: "🏆", label: "Champion" }
];

const FloatingReaction: React.FC<FloatingReactionProps> = ({ emoji, onAnimationEnd }) => {
  const [position] = useState(() => {
    const centerX = 50;
    const centerY = 50;
    const deadZoneRadius = 20;
    const margin = 5;
    
    while (true) {
      const x = margin + Math.random() * (100 - 2 * margin);
      const y = margin + Math.random() * (100 - 2 * margin);
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      
      if (distanceFromCenter > deadZoneRadius) {
        return {
          left: `${x}%`,
          top: `${y}%`
        };
      }
    }
  });
  
  return (
    <div 
      className="floating-reaction"
      style={position}
      onAnimationEnd={onAnimationEnd}
    >
      {emoji}
    </div>
  );
};

const ReactionGrid: React.FC<ReactionGridProps> = ({ onReaction, visible }) => (
  <div className={`reaction-grid ${!visible ? 'reaction-grid--hidden' : ''}`}>
    <div className="reaction-grid__container">
      {CHEER_EMOJIS.map(({ emoji, label }) => (
        <button
          key={emoji}
          onClick={() => onReaction(emoji)}
          className="reaction-button"
        >
          <span className="reaction-button__emoji">
            {emoji}
          </span>
          <span className="reaction-button__label">
            {label}
          </span>
        </button>
      ))}
    </div>
  </div>
);

const WorkoutPost: React.FC<WorkoutPostProps> = ({ post, imageUrl, onReaction, onHover, onLike, onDelete }) => (
  <div className="post">
    <div className="post__header">
      <div className="post__user-info">
        <img
          src="profileDefault.png"
          alt={post.username ?? "none"}
          className="post__avatar"
        />
        <span className="post__username">{post.username}</span>
        <button
          onClick={() => onDelete(post.id)}
          className="post__delete-button"
        >
          ✕
        </button>
      </div>
    </div>

    <div className="post__content">
      <div 
        className="post__image-container"
        onMouseEnter={() => onHover(post.id, true)}
        onMouseLeave={() => onHover(post.id, false)}
      >
        <img
          src={imageUrl}
          alt="Workout"
          className="post__image"
        />
        
        <ReactionGrid 
          visible={post.showReactions ?? false}
          onReaction={(emoji) => onReaction(post.id, emoji)}
        />
        
        {post.activeReactions?.map(reaction => (
          <FloatingReaction
            key={reaction.id}
            emoji={reaction.emoji}
            onAnimationEnd={() => onReaction(post.id, null, reaction.id)}
          />
        ))}
      </div>

      <div className="post__actions">
        <div className="post__buttons">
          <div className="post__action-buttons">
            <button 
              onClick={() => onLike(post.id, "thumbsUp")}
              className="post__button"
            >
              <Heart className="w-6 h-6" />
            </button>
            <button className="post__button">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button className="post__button">
              <Share2 className="w-6 h-6" />
            </button>
            <button 
              onClick={() => onLike(post.id, "trophy")}
              className="post__challenge-button"
            >
              <Trophy className="post__challenge-icon w-5 h-5" />
              <span className="post__challenge-text">Challenge</span>
              {(
                <span className="post__challenge-count">
                  {post.trophy}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="post__details">
          <p className="post__likes">{post.thumbsUp || 0} likes</p>
          <div className="post__challenges-count">
            <Trophy className="w-4 h-4" />
            <span>{post.trophy || 0} challenges</span>
          </div>
          <p className="post__caption">
            <span className="post__username">{post.username}</span>{' '}
            {post.content}
          </p>
          <p className="post__timestamp">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Post>>([]);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const subscription = client.models.PostforWorkout.observeQuery().subscribe({
      next: async (data) => {
        const sortedPosts = [...data.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const postsWithUIState = sortedPosts.map(post => ({
          ...post,
          showReactions: false,
          activeReactions: []
        }));

        setworkoutposts(postsWithUIState);

        if (useSpoofData) {
          const spoofedUrls: { [key: string]: string } = {};
          for (const item of data.items) {
            spoofedUrls[item.id] = "/picsoritdidnthappen.webp";
          }
          setImageUrls(spoofedUrls);
        } else {
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
    <div className="feed">
      <div className="feed__header">
       
        <div className="feed__challenges">
          <div className="challenge-alert challenge-alert--personal">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm">3 friends challenged you!</span>
          </div>
          <div className="challenge-alert challenge-alert--group">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Group Challenge: 100 pushups</span>
          </div>
          <div className="challenge-alert challenge-alert--weekly">
            <Trophy className="w-4 h-4 text-green-500" />
            <span className="text-sm">Weekly Challenge: 10k steps daily</span>
          </div>
          <button className="feed__header-button">
              <Trophy className="w-6 h-6" />
            </button>
            <button className="feed__header-button">
              <Camera className="w-6 h-6" />
            </button>
        </div>

      </div>

      <div className="feed__content">
        {workoutposts.map(post => (
          <WorkoutPost
            key={post.id}
            post={post}
            imageUrl={imageUrls[post.id] || "/picsoritdidnthappen.webp"}
            onReaction={(emoji) => reactToPost(post.id, "trophy")}
            onLike={reactToPost}
            onDelete={deletePost}
            onHover={(postId, isHovering) => {
              setworkoutposts(posts => 
                posts.map(p => 
                  p.id === postId ? { ...p, showReactions: isHovering } : p
                )
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default App;