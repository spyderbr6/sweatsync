import { useEffect, useState, useRef } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Heart, MessageCircle, Share2, Trophy } from 'lucide-react';
import ChallengeFeedHeader from './challengeFeedHeader';
import { CommentSection } from './CommentSection'; 
import { useNavigate } from 'react-router-dom';
import { useUrlCache } from './urlCacheContext';



const useSpoofData = true;
const client = generateClient<Schema>();

type Post = Schema["PostforWorkout"]["type"] & {
  showReactions: boolean;
  activeReactions: Array<{ id: number; emoji: string }>;
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
  onDelete: (id: string) => void;
  onHover: (id: string, isHovering: boolean) => void;
};

// Define allowed reaction fields
type ReactionFields =
  | "strong"
  | "fire"
  | "zap"
  | "fist"
  | "target"
  | "star"
  | "rocket"
  | "clap"
  | "trophy"
  | "thumbsUp"
  | "smiley";

// Define emoji mapping type
type EmojiMapping = {
  [key: string]: ReactionFields;
};

const CHEER_EMOJIS = [
  { emoji: "💪", label: "Strong" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "⚡", label: "Energy" },
  { emoji: "👊", label: "Fist Bump" },
  { emoji: "🎯", label: "Goal" },
  { emoji: "⭐", label: "Star" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🏆", label: "Trophy" }
];

const FloatingReaction: React.FC<FloatingReactionProps> = ({ emoji, onAnimationEnd }) => {
  const [position] = useState(() => {
    const centerX = 50;
    const centerY = 50;
    const deadZoneRadius = 30;
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

//Date Calculator for displaying date time ago
const getTimeAgo = (timestamp: string) => {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }

  return 'Just now';
};

const WorkoutPost: React.FC<WorkoutPostProps> = ({ post, imageUrl, onReaction, onHover, onDelete }) => {
  // Add this line to get the navigate function
  const navigate = useNavigate();

  // Add this handler function
  const handlePostClick = () => {
    navigate(`/post/${post.id}`);
  };

  return (  
  <div className="post">
    <div className="post__header" onClick={handlePostClick}>
      <div className="post__user-info">
        <img
          src="profileDefault.png"
          alt={post.username ?? "none"}
          className="post__avatar"
        />
        <span className="post__username">{post.username}</span>
        <button
            onClick={(e) => {
              e.stopPropagation(); // This prevents the navigation when clicking delete
              onDelete(post.id);
            }}
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
          visible={post.showReactions}
          onReaction={(emoji) => onReaction(post.id, emoji, undefined)}
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
              onClick={() => onReaction(post.id, "👍")}
              className="post__heart-button"
            >
              <Heart className="w-6 h-6" />
              {
                <span className="post__heart-count">
                  {post.thumbsUp}
                </span>
              }
            </button>
            <button className="post__button">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button
              className="post__button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Check out my workout!',
                    text: 'Join me on SweatSync',
                    url: window.location.href // or a specific URL for your post
                  })
                    .then(() => console.log('Successfully shared!'))
                    .catch((error) => console.error('Error sharing:', error));
                } else {
                  // Fallback: copy link to clipboard or show a message
                  console.log('Web Share API not supported in this browser.');
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              }}
            >
              <Share2 className="w-6 h-6" />
            </button>
            <button
              className="post__challenge-button"
            >
              <Trophy className="post__challenge-icon w-5 h-5" />
              <span className="post__challenge-text">Challenge</span>
              {
                <span className="post__challenge-count">
                  {post.trophy}
                </span>
              }
            </button>
          </div>
        </div>

        <div className="post__details">
          <p className="post__caption">
            <span className="post__username">{post.username}</span>{' '}
            {post.content}
          </p>
                  <CommentSection postId={post.id} />
          <p className="post__timestamp">
            {getTimeAgo(post.createdAt)}
          </p>
        </div>
      </div>
    </div>
  </div>
);
};

function App() {
  const [workoutposts, setworkoutposts] = useState<Array<Post>>([]);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
  const [visibleCount, setVisibleCount] = useState<number>(10); // number of posts to show initially
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const BATCH_SIZE = 10; // number of posts to load each time
  const { getStorageUrl } = useUrlCache();

  useEffect(() => {
    const subscription = client.models.PostforWorkout.observeQuery().subscribe({
      next: async (data) => {
        const sortedPosts = [...data.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
  
        // Map incoming posts to UI state
        const fieldToEmoji: { [key: string]: string } = {
          strong: "💪",
          fire: "🔥",
          zap: "⚡",
          fist: "👊",
          target: "🎯",
          star: "⭐",
          rocket: "🚀",
          clap: "👏",
          trophy: "🏆",
          thumbsUp: "👍",
        };
  
        const postsWithUIState = sortedPosts.map(post => {
          const activeReactions: Array<{ id: number; emoji: string }> = [];
          for (const [field, emoji] of Object.entries(fieldToEmoji)) {
            const count = (post as any)[field] || 0;
            for (let i = 0; i < count; i++) {
              activeReactions.push({
                id: Date.now() + Math.floor(Math.random() * 10000), 
                emoji 
              });
            }
          }
          return {
            ...post,
            showReactions: false,
            activeReactions,
          };
        });
  
        setworkoutposts(prevPosts => {
          // Map previous posts by ID to easily find old states
          const prevMap = new Map(prevPosts.map(p => [p.id, p]));
  
          return postsWithUIState.map(newPost => {
            const oldPost = prevMap.get(newPost.id);
            return {
              ...newPost,
              // Preserve showReactions if it was previously set
              showReactions: oldPost?.showReactions ?? newPost.showReactions,
            };
          });
        });
  
        if (useSpoofData) {
          const spoofedUrls: { [key: string]: string } = {};
          for (const item of data.items) {
            spoofedUrls[item.id] = "/picsoritdidnthappen.webp";
          }
          setImageUrls(spoofedUrls);
        } else {
          // New cached URL fetching
          const urls: { [key: string]: string } = {};
          for (const item of data.items) {
            if (item.url) {
              try {
                const url = await getStorageUrl(item.url);
                urls[item.id] = url;
              } catch (error) {
                console.error('Error fetching image URL:', error);
                urls[item.id] = "/picsoritdidnthappen.webp";
              }
            }
          }
          setImageUrls(urls);
        }
      },
    });
  
    return () => subscription.unsubscribe();
  }, []);

  // Intersection Observer to load more posts when near the bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          // Load more posts if available
          if (visibleCount < workoutposts.length) {
            setVisibleCount((prev) => prev + BATCH_SIZE);
          }
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [workoutposts, visibleCount]);

  function deletePost(id: string) {
    if (window.confirm("Are you sure you want to delete this post?")) {
      client.models.PostforWorkout.delete({ id }).catch((error) => {
        console.error("Error Deleting Post", error);
        alert("Failed to delete the post. Please try again.");
      });
    }
  }

  async function reactToPost(id: string, emojiType: string | null, reactionId?: number) {
    // Handle animation cleanup
    if (!emojiType && reactionId) {
      setworkoutposts(posts =>
        posts.map(p =>
          p.id === id
            ? {
              ...p,
              activeReactions: p.activeReactions.filter(r => r.id !== reactionId)
            }
            : p
        )
      );
      return;
    }

    try {
      const response = await client.models.PostforWorkout.get({ id });
      const post = response?.data;

      if (post && emojiType) {
        const emojiToField: EmojiMapping = {
          "💪": "strong",
          "🔥": "fire",
          "⚡": "zap",
          "👊": "fist",
          "🎯": "target",
          "⭐": "star",
          "🚀": "rocket",
          "👏": "clap",
          "🏆": "trophy",
          "👍": "thumbsUp"
        };

        const fieldName = emojiToField[emojiType];
        if (fieldName) {
          const updatedValue = (post[fieldName] || 0) + 1;

          await client.models.PostforWorkout.update({
            id,
            [fieldName]: updatedValue
          });

          // Add floating reaction animation
          setworkoutposts(posts =>
            posts.map(p =>
              p.id === id
                ? {
                  ...p,
                  [fieldName]: updatedValue,
                  activeReactions: [...p.activeReactions, {
                    id: Date.now(),
                    emoji: emojiType
                  }]
                }
                : p
            )
          );
        }
      }
    } catch (error) {
      console.error("Error reacting to post", error);
    }
  }

  return (
    <div className="feed">
      <ChallengeFeedHeader />

      <div className="feed__content">
        {workoutposts.slice(0, visibleCount).map(post => (
          <WorkoutPost
            key={post.id}
            post={post}
            imageUrl={imageUrls[post.id] || "/picsoritdidnthappen.webp"}
            onReaction={reactToPost}
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

        {/* Sentinel element to trigger loading more */}
        <div ref={loadMoreRef} style={{ height: "50px" }}></div>
      </div>
    </div>
  );
}

export default App;
