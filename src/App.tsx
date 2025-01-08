import { useEffect, useState, useRef } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Heart, MessageCircle, Share2, Trophy, Trash2 } from 'lucide-react';
import { CommentSection } from './CommentSection';
import { useNavigate } from 'react-router-dom';
import { useUrlCache } from './urlCacheContext';
import { useUser } from './userContext';
import { shareContent } from './utils/shareAction';
import { promptAction } from './utils/promptAction';
import ActionMenu from './components/cardActionMenu/cardActionMenu';
import { PostChallenges } from './components/PostChallenges/postChallenges';

const useSpoofData = false;
const client = generateClient<Schema>();

type Post = Schema["PostforWorkout"]["type"] & {
  showReactions: boolean;
  activeReactions: Array<{ id: string; emoji: string }>;
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
  profileImageUrl: string;
  onReaction: (id: string, emoji: string | null, reactionId?: string) => void;  // Changed to string
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

const WorkoutPost: React.FC<WorkoutPostProps> = ({ post, imageUrl, profileImageUrl, onReaction, onHover, onDelete }) => {
  // Add this line to get the navigate function
  const navigate = useNavigate();
  const { userId } = useUser(); // Add this line to get current user's ID
  const [showChallenges, setShowChallenges] = useState(false);

  // Add this handler function
  const handlePostClick = () => {
    navigate(`/post/${post.id}`);
  };

  const [visibleCommentsPostId, setVisibleCommentsPostId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const isHovered = useRef(false);

  // Function to clear the existing timer
  const clearReactionTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Function to start the hide timer
  const startReactionTimer = () => {
    clearReactionTimer();
    timerRef.current = window.setTimeout(() => {
      if (isHovered.current) {
        onHover(post.id, false);
      }
    }, 2000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearReactionTimer();
  }, []);

  const toggleCommentSection = (postId: string) => {
    setVisibleCommentsPostId((prev) => (prev === postId ? null : postId));
  };

  const getPostActions = (post: Post) => {
    const isOwner = post.userID === userId;

    return [
      {
        label: 'Delete Post',
        icon: <Trash2 size={16} />,
        onClick: () => onDelete(post.id),
        destructive: true,
        show: isOwner,
      }
    ];
  };

  return (
    <div className="post">
      <div className="post__header" >
        <div className="post__user-info">
          <img
            src={profileImageUrl ?? "profileDefault.png"}
            alt={post.username ?? "none"}
            className="post__avatar"
          />
          <span className="post__username" onClick={handlePostClick}>{post.username}</span>
          <div className="post__delete-button">{userId === post.userID && (
            <ActionMenu actions={getPostActions(post)} position="right" />
          )}
          </div>
        </div>
      </div>

      <div className="post__content">
        <div
          className="post__image-container"
          onMouseEnter={() => {
            isHovered.current = true;
            clearReactionTimer();
            onHover(post.id, true);
          }}
          onMouseLeave={() => {
            isHovered.current = false;
            clearReactionTimer();
            onHover(post.id, false);
          }}
          onMouseMove={() => {
            if (post.showReactions) {
              clearReactionTimer();
              startReactionTimer();
            }
          }}
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
                aria-label="Like Button"
              >
                <Heart className="w-6 h-6" />
                {<span className="post__heart-count">{post.thumbsUp}</span>}
              </button>
              <button
                className="post__button"
                onClick={() => toggleCommentSection(post.id)}
                aria-label="Toggle comments"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                className="post__button"
                aria-label="Share Button"
                onClick={() => {
                  shareContent(post.content ?? 'I worked Out', 'Join me on SweatSync', `${import.meta.env.BASE_URL}post/${post.id}`)
                }}
              >
                <Share2 className="w-6 h-6" />
              </button>
              <button
                className="post__challenge-button"
                onClick={() => setShowChallenges(!showChallenges)}
              >
                <Trophy className="post__challenge-icon w-5 h-5" />
                <span className="post__challenge-text">Challenge</span>
                <span className="post__challenge-count">
                  {post.smiley}
                </span>
              </button>
            </div>
          </div>

          {showChallenges && (
            <div className="post__challenges-container">
              <PostChallenges
                postId={post.id}
                className="mt-4"
                onChallengeClick={(challengeId) => {
                  navigate(`/challenge/${challengeId}`);
                  setShowChallenges(false); // Optionally hide challenges after selection
                }}
              />
            </div>
          )}

          <div className="post__details">
            <p className="post__caption">
              <span className="post__username">{post.username}</span>{' '}
              {post.content}
            </p>
            <CommentSection
              postId={post.id}
              commentsLimit={3} // Number of comments to initially load
              showInput={visibleCommentsPostId === post.id} // Control input visibility
            />            <p className="post__timestamp">
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
  const [profilePictureUrls, setProfilePictureUrls] = useState<{ [key: string]: string }>({});
  const [visibleCount, setVisibleCount] = useState<number>(4); // number of posts to show initially
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const BATCH_SIZE = 4; // number of posts to load each time
  const { getStorageUrl } = useUrlCache();
  const { userId } = useUser();  // Move this to component level

  useEffect(() => {
    const subscription = client.models.PostforWorkout.observeQuery().subscribe({
      next: async (data) => {
        const sortedPosts = [...data.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Get unique user IDs and ensure they're not null
        const uniqueUserIds = Array.from(
          new Set(
            sortedPosts
              .map(post => post.userID)
              .filter((id): id is string => id !== null && id !== undefined)
          )
        );

        const profileUrls: { [userId: string]: string } = {};

        try {
          // Fetch users with multiple queries in parallel
          const userPromises = uniqueUserIds.map(userId =>
            client.models.User.get({ id: userId })
          );

          const userResults = await Promise.all(userPromises);

          // Process all profile pictures in parallel
          const userProfilePromises = userResults.map(async (result) => {
            const user = result.data;
            if (user && user.id) {  // Ensure user and user.id exist
              if (user.pictureUrl) {
                try {
                  const url = await getStorageUrl(user.pictureUrl);
                  profileUrls[user.id] = url;
                } catch (error) {
                  console.error(`Error fetching profile URL for user ${user.id}:`, error);
                  profileUrls[user.id] = "/profileDefault.png";
                }
              } else {
                profileUrls[user.id] = "/profileDefault.png";
              }
            }
          });

          await Promise.all(userProfilePromises);
        } catch (error) {
          console.error('Error fetching user profiles:', error);
          uniqueUserIds.forEach(userId => {
            profileUrls[userId] = "/profileDefault.png";
          });
        }

        setProfilePictureUrls(profileUrls); // Store profile picture URLs in state

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
          const activeReactions: Array<{ id: string; emoji: string }> = [];
          for (const [field, emoji] of Object.entries(fieldToEmoji)) {
            const count = (post as any)[field] || 0;
            for (let i = 0; i < count; i++) {
              activeReactions.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  const deletePost = async (id: string) => {
    // Now use the userId from above instead of calling useUser() here
    const post = workoutposts.find(p => p.id === id);

    if (!post) {
      alert("Post not found");
      return;
    }

    // Check if current user is the author
    if (post.userID !== userId) {  // Use userId from above
      alert("You can only delete your own posts");
      return;
    }

    if (await promptAction({
      title: "Delete Post",
      message: 'Are you sure you want to delete this post?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    })) {
      client.models.PostforWorkout.delete({ id })
        .catch((error) => {
          console.error("Error Deleting Post", error);
          alert("Failed to delete the post. Please try again.");
        });
    }
  };


  async function reactToPost(id: string, emojiType: string | null, reactionId?: string) {
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

          const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Add floating reaction animation
          setworkoutposts(posts =>
            posts.map(p =>
              p.id === id
                ? {
                  ...p,
                  [fieldName]: updatedValue,
                  activeReactions: [...p.activeReactions, {
                    id: uniqueId,
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

      <div className="feed__content">
        {workoutposts.slice(0, visibleCount).map(post => (
          <WorkoutPost
            key={post.id}
            post={post}
            imageUrl={imageUrls[post.id] || "/picsoritdidnthappen.webp"}
            profileImageUrl={post.userID ? profilePictureUrls[post.userID] || "/profileDefault.png" : "/profileDefault.png"}
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