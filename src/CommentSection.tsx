import React, { useState, useEffect } from 'react';
import { generateClient } from "aws-amplify/api";
import { useNavigate } from 'react-router-dom';
import { useUser } from './userContext';
import { getPostComments, createComment, deleteComment, editComment, EnrichedComment } from './commentOperations';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import type { Schema } from "../amplify/data/resource";
import { useUrlCache } from './urlCacheContext';
import { TaggableCommentInput } from './components/TaggableCommentInput/TaggableCommentInput';

const client = generateClient<Schema>();

interface CommentSectionProps {
  postId: string;
  commentsLimit?: number;
  showInput?: boolean;
}

const sendCommentNotification = async (
  recipientId: string,
  notificationType: 'COMMENT_ON_POST' | 'USER_TAGGED',
  commenterUsername: string,
  commentId: string,
  postId: string  // Add postId as parameter
) => {
  if (!recipientId) return;

  const notificationData = {
    postId,
    commentId,
  };

  const title = notificationType === 'COMMENT_ON_POST' 
    ? 'New Comment' 
    : 'You were mentioned';

  const body = notificationType === 'COMMENT_ON_POST'
    ? `${commenterUsername} commented on your post`
    : `${commenterUsername} mentioned you in a comment`;

  try {
    await client.queries.sendPushNotificationFunction({
      type: notificationType,
      userID: recipientId,
      title,
      body,
      data: JSON.stringify(notificationData)
    });
  } catch (error) {
    console.error(`Error sending ${notificationType} notification:`, error);
  }
};

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  commentsLimit = 3,
  showInput = false
}) => {
  const navigate = useNavigate();
  const { userId } = useUser();
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getStorageUrl } = useUrlCache();
  const [commentProfileUrls, setCommentProfileUrls] = useState<{ [key: string]: string }>({});
  const [postOwnerId, setPostOwnerId] = useState<string | null>(null);

  // Fetch post data to get owner ID
  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const postResult = await client.models.PostforWorkout.get({ id: postId });
        if (postResult.data?.userID) {
          setPostOwnerId(postResult.data.userID);
        }
      } catch (err) {
        console.error('Error fetching post data:', err);
      }
    };

    fetchPostData();
  }, [postId]);

  useEffect(() => {
    const loadComments = async () => {
      try {
        setIsLoading(true);
        const fetchedComments = await getPostComments(postId, commentsLimit);
        setComments(fetchedComments);

        // Load profile pictures for comments
        const profileUrls: { [key: string]: string } = {};
        for (const comment of fetchedComments) {
          if (comment.userId && comment.profilePicture) {
            try {
              const profileUrl = await getStorageUrl(comment.profilePicture);
              profileUrls[comment.userId] = profileUrl;
            } catch (error) {
              profileUrls[comment.userId] = "/profileDefault.png";
            }
          }
        }
        setCommentProfileUrls(profileUrls);
        setError(null);
      } catch (err) {
        setError('Failed to load comments');
        console.error('Error loading comments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [postId, commentsLimit]);

  // Update handleSubmitComment:
  const handleSubmitComment = async (content: string, taggedUserIds: string[]) => {
    if (!userId || !postOwnerId) return;
  
    try {
      const comment = await createComment(
        postId,
        userId,
        content,
        postOwnerId,
        taggedUserIds
      );
  
      setComments(prevComments => [comment, ...prevComments]);
  
      // Get commenter's username for notifications
      const userResult = await client.models.User.get({ id: userId });
      const commenterUsername = userResult.data?.preferred_username || 
                              userResult.data?.username || 
                              'Someone';
  
      // Notify post owner if they're not the commenter
      if (postOwnerId !== userId) {
        await sendCommentNotification(
          postOwnerId,
          'COMMENT_ON_POST',
          commenterUsername,
          comment.id,
          postId  // Pass postId from props
        );
      }
  
      // Notify tagged users (excluding self and post owner)
      const uniqueTaggedUsers = new Set(taggedUserIds);
      for (const taggedId of uniqueTaggedUsers) {
        if (taggedId !== userId && taggedId !== postOwnerId) {
          await sendCommentNotification(
            taggedId,
            'USER_TAGGED',
            commenterUsername,
            comment.id,
            postId  // Pass postId from props
          );
        }
      }
  
    } catch (err) {
      setError('Failed to post comment');
      console.error('Error posting comment:', err);
    }
  };

  // Render tagged users in comment content
  const renderCommentContent = (comment: EnrichedComment) => {
    if (!comment.taggedUsers || comment.taggedUsers.length === 0) {
      return <p className="comment-section__content">{comment.content}</p>;
    }

    let content = comment.content || '';
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    comment.taggedUsers.forEach(user => {
      const tag = `@${user.username}`;
      const index = content.indexOf(tag, lastIndex);
      if (index !== -1) {
        // Add text before the tag
        parts.push(content.substring(lastIndex, index));
        // Add the tagged username
        parts.push(
          <span key={user.id} className="tagged-user">
            {tag}
          </span>
        );
        lastIndex = index + tag.length;
      }
    });

    // Add remaining text
    parts.push(content.substring(lastIndex));

    return <p className="comment-section__content">{parts}</p>;
  };

  // Keep existing delete and edit functions
  const handleDeleteComment = async (commentId: string) => {
    if (!commentId || !userId) return;

    const commentToDelete = comments.find(comment => comment.id === commentId);

    if (!commentToDelete) {
      setError('Comment not found');
      return;
    }

    if (commentToDelete.userId !== userId) {
      setError('You can only delete your own comments');
      return;
    }

    try {
      if (!window.confirm('Are you sure you want to delete this comment?')) {
        return;
      }

      setComments(prevComments =>
        prevComments.filter(comment => comment.id !== commentId)
      );

      const success = await deleteComment(commentId);

      if (!success) {
        const oldComments = await getPostComments(postId, commentsLimit);
        setComments(oldComments);
        setError('Failed to delete comment');
      }
    } catch (err) {
      const oldComments = await getPostComments(postId, commentsLimit);
      setComments(oldComments);
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      console.error('Error deleting comment:', err);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const updatedComment = await editComment(commentId, editContent);
      if (updatedComment) {
        setComments(prevComments =>
          prevComments.map(comment =>
            comment.id === commentId ? updatedComment : comment
          )
        );
        setEditingCommentId(null);
        setEditContent('');
      }
    } catch (err) {
      setError('Failed to edit comment');
      console.error('Error editing comment:', err);
    }
  };

  if (isLoading) {
    return <div className="comment-section__loading">Loading comments...</div>;
  }

  return (
    <div className="comment-section">
      {error && (
        <div className="comment-section__error">
          {error}
        </div>
      )}

      {userId && showInput && (
        <TaggableCommentInput
          onSubmit={handleSubmitComment}
          disabled={!postOwnerId}
        />
      )}

      <div className="comment-section__comments">
        {comments.map((comment) => (
          <div key={comment.id} className="comment-section__comment">
            <div className="comment-section__user">
              <img
                src={commentProfileUrls[comment.userId || ''] || "/profileDefault.png"}
                alt="User Avatar"
                className="comment-section__avatar"
              />
              <span className="comment-section__username">
                {comment.friendlyUsername || 'Anonymous User'}
              </span>
            </div>

            {editingCommentId === comment.id ? (
              <div className="comment-section__edit-form">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="comment-section__edit-input"
                />
                <button
                  onClick={() => handleEditComment(comment.id)}
                  className="comment-section__edit-button"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingCommentId(null)}
                  className="comment-section__cancel-button"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              renderCommentContent(comment)
            )}

            {userId === comment.userId && editingCommentId !== comment.id && (
              <div className="comment-section__actions">
                <button
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditContent(comment.content || '');
                  }}
                  className="comment-section__action-button"
                  aria-label="Edit comment"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="comment-section__action-button comment-section__action-button--delete"
                  aria-label="Delete comment"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            <span className="comment-section__timestamp">
              {comment.timestamp ? new Date(comment.timestamp).toLocaleDateString() : 'Unknown date'}
            </span>
          </div>
        ))}
      </div>

      {comments.length > 0 && comments.length > commentsLimit && (
        <button
          onClick={() => navigate(`/post/${postId}`)}
          className="comment-section__view-all"
        >
          View all comments
        </button>
      )}
    </div>
  );
};