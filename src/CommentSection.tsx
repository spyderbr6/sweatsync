import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './userContext';
import { getPostComments, createComment, deleteComment, editComment,EnrichedComment } from './commentOperations';
import { Pencil, Trash2, X, Check, SendHorizonal } from 'lucide-react';
import type { Schema } from "../amplify/data/resource";
import { useUrlCache } from './urlCacheContext';


type Comment = Schema['Comment']['type'] & {
  friendlyUsername: string; 
  profilePicture?: string | null;
};

interface CommentSectionProps {
  postId: string;
  commentsLimit?: number;
  showInput?: boolean;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ 
  postId, 
  commentsLimit = 3, 
  showInput = false
}) => {
  const navigate = useNavigate();
  const { userId } = useUser();
  const [comments, setComments] = useState<EnrichedComment[]>([]);  // Use EnrichedComment type
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getStorageUrl } = useUrlCache();
  const [commentProfileUrls, setCommentProfileUrls] = useState<{[key: string]: string}>({});


  useEffect(() => {
    const loadComments = async () => {
      try {
        setIsLoading(true);
        const fetchedComments = await getPostComments(postId, commentsLimit);
        setComments(fetchedComments);  // Should be properly typed now

        // Load profile pictures for comments
        const profileUrls: {[key: string]: string} = {};
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


  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newComment.trim()) return;
  
    try {
      const comment = await createComment(
        postId,
        userId,
        newComment.trim()
      );
      
      // comment is already properly typed as EnrichedComment
      setComments(prevComments => [comment, ...prevComments]);
      setNewComment('');
    } catch (err) {
      setError('Failed to post comment');
      console.error('Error posting comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!commentId || !userId) return;
  
    // Find the comment to verify ownership
    const commentToDelete = comments.find(comment => comment.id === commentId);
    
    if (!commentToDelete) {
      setError('Comment not found');
      return;
    }
  
    // Verify the user owns the comment
    if (commentToDelete.userId !== userId) {
      setError('You can only delete your own comments');
      return;
    }
  
    try {
      // Show confirmation dialog
      if (!window.confirm('Are you sure you want to delete this comment?')) {
        return;
      }
  
      // Optimistically update UI
      setComments(prevComments => 
        prevComments.filter(comment => comment.id !== commentId)
      );
  
      // Attempt to delete from backend
      const success = await deleteComment(commentId);
      
      if (!success) {
        // Rollback if deletion failed
        const oldComments = await getPostComments(postId, commentsLimit);
        setComments(oldComments);
        setError('Failed to delete comment');
      }
    } catch (err) {
      // Rollback on error
      const oldComments = await getPostComments(postId, commentsLimit);
      setComments(oldComments);
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      console.error('Error deleting comment:', err);
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content || '');
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditContent('');
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
        <form onSubmit={handleSubmitComment} className="comment-section__form">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="comment-section__input"
          />
          <button 
            type="submit"
            disabled={!newComment.trim()}
            className="comment-section__submit"
          >
            <SendHorizonal size={16}/>
          </button>
        </form>
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
                  onClick={cancelEditing}
                  className="comment-section__cancel-button"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <p className="comment-section__content">
                {comment.content || ''}
              </p>
            )}

            {userId === comment.userId && editingCommentId !== comment.id && (
              <div className="comment-section__actions">
                <button
                  onClick={() => startEditing(comment)}
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