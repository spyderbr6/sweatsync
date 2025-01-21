import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { Heart, MessageCircle, Share2, Trophy } from 'lucide-react';
import { CommentSection } from './CommentSection';
import { useUrlCache } from './urlCacheContext';
import { PostChallenges } from './components/PostChallenges/postChallenges';

const client = generateClient<Schema>();

// Types from your existing implementation
type Post = Schema["PostforWorkout"]["type"] & {
    showReactions: boolean;
    activeReactions: Array<{ id: number; emoji: string }>;
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

type FloatingReactionProps = {
    emoji: string;
    onAnimationEnd: () => void;
};

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

type ReactionGridProps = {
    onReaction: (emoji: string) => void;
    visible: boolean;
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

const SinglePostPage: React.FC = () => {
    const { getStorageUrl } = useUrlCache();
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const [post, setPost] = useState<Post | null>(null);
    const [imageUrl, setImageUrl] = useState<string>("/picsoritdidnthappen.webp");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string>("/profileDefault.png");
    const [showChallenges, setShowChallenges] = useState(false);


    // Fetch post data
    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) {
                setError("No post ID provided");
                return;
            }

            try {
                setLoading(true);
                const response = await client.models.PostforWorkout.get({ id: postId });

                if (!response.data) {
                    setError("Post not found");
                    return;
                }

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

                // Initialize activeReactions based on existing reaction counts
                const activeReactions: Array<{ id: number; emoji: string }> = [];
                for (const [field, emoji] of Object.entries(fieldToEmoji)) {
                    const count = (response.data as any)[field] || 0;
                    for (let i = 0; i < count; i++) {
                        activeReactions.push({
                            id: Date.now() + Math.floor(Math.random() * 10000),
                            emoji
                        });
                    }
                }

                // Add UI state properties to the post
                const postWithUIState = {
                    ...response.data,
                    showReactions: false,
                    activeReactions,
                };

                setPost(postWithUIState);


                // Updated image URL fetching using cache
                if (response.data.url) {
                    try {
                        const url = await getStorageUrl(response.data.url);
                        setImageUrl(url);
                    } catch (urlError) {
                        console.error('Error retrieving post image:', urlError);
                        setImageUrl("/picsoritdidnthappen.webp");
                    }
                }
                if (response.data?.userID) {
                    try {
                        const userResult = await client.models.User.get({ id: response.data.userID });
                        if (userResult.data?.pictureUrl) {
                            const url = await getStorageUrl(userResult.data.pictureUrl);
                            setProfilePictureUrl(url);
                        }
                    } catch (error) {
                        console.error('Error fetching user profile picture:', error);
                        setProfilePictureUrl("/profileDefault.png");
                    }
                }
            } catch (err) {
                console.error('Error fetching post:', err);
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    // Handle reactions
    const handleReaction = async (emoji: string) => {
        if (!post) return;

        const emojiToField: { [key: string]: string } = {
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

        try {
            const fieldName = emojiToField[emoji];
            if (fieldName) {
                const updatedValue = ((post[fieldName as keyof Post] as number) || 0) + 1;

                await client.models.PostforWorkout.update({
                    id: post.id,
                    [fieldName]: updatedValue
                });

                // Create a fresh set of all reactions including the new one
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

                setPost(prev => {
                    if (!prev) return prev;

                    // Generate all reactions including the updated count
                    const allReactions: Array<{ id: number; emoji: string }> = [];
                    for (const [field, emojiSymbol] of Object.entries(fieldToEmoji)) {
                        const count = field === fieldName
                            ? updatedValue
                            : (prev[field as keyof Post] as number) || 0;

                        for (let i = 0; i < count; i++) {
                            allReactions.push({
                                id: Date.now() + Math.floor(Math.random() * 10000) + i,
                                emoji: emojiSymbol
                            });
                        }
                    }

                    return {
                        ...prev,
                        [fieldName]: updatedValue,
                        activeReactions: allReactions
                    };
                });
            }
        } catch (error) {
            console.error("Error updating reaction:", error);
        }
    };

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

    // Handle share
    const handleShare = async () => {
        const shareUrl = window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out this workout!',
                    text: post?.content || 'Join me on SweatSync',
                    url: shareUrl
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            await navigator.clipboard.writeText(shareUrl);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div>Loading post...</div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="text-red-600 mb-4">{error || "Post not found"}</div>
                <button
                    className="text-blue-500 hover:text-blue-700"
                    onClick={() => navigate('/')}
                >
                    Return to Feed
                </button>
            </div>
        );
    }

    return (
        <div className="single-post-container">
            <div className="single-post-single">
                <div className="post__header">
                    <div className="post__user-info">
                        <img
                            src={profilePictureUrl ?? "../profileDefault.png"}
                            alt={post.username ?? "User"}
                            className="post__avatar"
                        />
                        <span className="post__username">{post.username}</span>
                    </div>
                </div>

                <div className="post__content">
                    <div
                        className="post__image-container"
                        onMouseEnter={() => setPost(prev => prev ? { ...prev, showReactions: true } : null)}
                        onMouseLeave={() => setPost(prev => prev ? { ...prev, showReactions: false } : null)}
                    >
                        <img
                            src={imageUrl}
                            alt="Workout"
                            className="post__image"
                        />

                        <ReactionGrid
                            visible={post.showReactions}
                            onReaction={(emoji) => handleReaction(emoji)}
                        />

                        {post.activeReactions?.map(reaction => (
                            <FloatingReaction
                                key={reaction.id}
                                emoji={reaction.emoji}
                                onAnimationEnd={() => {
                                    setPost(prev => {
                                        if (!prev) return null;
                                        return {
                                            ...prev,
                                            activeReactions: prev.activeReactions.filter(r => r.id !== reaction.id)
                                        };
                                    });
                                }}
                            />
                        ))}
                    </div>

                    <div className="post__actions">
                        <div className="post__buttons">
                            <div className="post__action-buttons">
                                <button
                                    onClick={() => handleReaction("👍")}
                                    className="post__heart-button"
                                >
                                    <Heart className="w-6 h-6" />
                                    <span className="post__heart-count">
                                        {post.thumbsUp}
                                    </span>
                                </button>
                                <button className="post__button">
                                    <MessageCircle className="w-6 h-6" />
                                </button>
                                <button
                                    className="post__button"
                                    onClick={handleShare}
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

                        {/* Add PostChallenges component */}
                        {showChallenges && post?.id && (
                            <div className="post__challenges-container">
                                <PostChallenges
                                    postId={post.id}
                                    className="mt-4"
                                    onChallengeClick={(challengeId) => {
                                        navigate(`/challenge/${challengeId}`);
                                        setShowChallenges(false);
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
                                commentsLimit={10} // Number of comments to initially load
                                showInput={true} // Control input visibility
                                postOwnerId={post.userID || ''}
                            />            <p className="post__timestamp">
                                {getTimeAgo(post.createdAt)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SinglePostPage;