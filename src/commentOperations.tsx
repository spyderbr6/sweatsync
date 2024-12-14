import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Update the type for enriched comments
export type EnrichedComment = Schema['Comment']['type'] & {
  friendlyUsername: string;
  profilePicture?: string | null;
};

interface UserCache {
  username: string;
  picture?: string | null;  // Add profile picture path
}
// Cache for usernames to avoid multiple lookups
const userCache: { [key: string]: UserCache } = {};

// Get username for a user ID
async function getUserInfo(userId: string): Promise<UserCache> {
  // Check cache first
  if (userCache[userId]) {
    return userCache[userId];
  }

  try {
    // Get user data
    const userResult = await client.models.User.get({ id: userId });
    
    const userInfo: UserCache = {
      username: userResult.data?.preferred_username || 
                userResult.data?.username || 
                'Anonymous User',
      picture: userResult.data?.picture
    };
    
    // Cache the result
    userCache[userId] = userInfo;
    return userInfo;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      username: 'Anonymous User'
    };
  }
}

// Fetch comments for a post
export async function getPostComments(postId: string, limit: number = 3): Promise<EnrichedComment[]> {
  try {
    const comments = await client.models.Comment.list({
      filter: {
        postId: { eq: postId }
      },
      limit
    });

    // Map to properly typed comments
    return await Promise.all(
      comments.data.map(async (comment): Promise<EnrichedComment> => {
        if (!comment.userId) {
          return {
            ...comment,
            friendlyUsername: 'Anonymous User',  // string
            profilePicture: null
          };
        }

        const userInfo = await getUserInfo(comment.userId);
        return {
          ...comment,
          friendlyUsername: userInfo.username,  // string
          profilePicture: userInfo.picture
        };
      })
    );
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

// Create a new comment
export async function createComment(
  postId: string,
  userId: string,
  content: string
): Promise<EnrichedComment> {  // Specify return type
  const now = new Date().toISOString();
  
  try {
    const result = await client.models.Comment.create({
      postId,
      userId,
      content,
      timestamp: now,
      createdAt: now,
      updatedAt: now
    });

    if (result.data) {
      // Get the user info
      const userInfo = await getUserInfo(userId);
      
      // Return properly typed enriched comment
      return {
        ...result.data,
        friendlyUsername: userInfo.username,  // Use the string username
        profilePicture: userInfo.picture
      };
    }

    throw new Error('Failed to create comment');
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

// Delete a comment
export async function deleteComment(commentId: string): Promise<boolean> {
  if (!commentId) {
    throw new Error('Comment ID is required');
  }

  try {
    // First verify the comment exists
    const commentResult = await client.models.Comment.get({ id: commentId });
    if (!commentResult.data) {
      throw new Error('Comment not found');
    }

    // Delete the comment
    await client.models.Comment.delete({
      id: commentId
    });

    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to delete comment');
  }
}

// Edit a comment
export async function editComment(commentId: string, content: string): Promise<EnrichedComment | null> {
  try {
    const result = await client.models.Comment.update({
      id: commentId,
      content,
      updatedAt: new Date().toISOString()
    });

    if (result.data && result.data.userId) {
      const userInfo = await getUserInfo(result.data.userId);
      return {
        ...result.data,
        friendlyUsername: userInfo.username, // Now returns string instead of UserCache
        profilePicture: userInfo.picture
      };
    }
    return null;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
}