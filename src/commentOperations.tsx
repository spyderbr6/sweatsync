import { generateClient } from "aws-amplify/data";
import { fetchUserAttributes } from 'aws-amplify/auth';
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Cache for usernames to avoid multiple lookups
const usernameCache: { [key: string]: string } = {};

// Get username for a user ID
async function getFriendlyUsername(userId: string): Promise<string> {
  // Check cache first
  if (usernameCache[userId]) {
    return usernameCache[userId];
  }

  try {
    // Get user attributes
    const userAttrs = await fetchUserAttributes();
    const username = userAttrs.preferred_username || userAttrs.username || 'Anonymous User';
    
    // Cache the result
    usernameCache[userId] = username;
    return username;
  } catch (error) {
    console.error('Error fetching username:', error);
    return 'Anonymous User';
  }
}

// Fetch comments for a post
export async function getPostComments(postId: string, limit: number = 3) {
  try {
    const comments = await client.models.Comment.list({
      filter: {
        postId: { eq: postId }
      },
      limit
    });

    // Enrich comments with usernames
    const enrichedComments = await Promise.all(
      comments.data.map(async (comment) => ({
        ...comment,
        friendlyUsername: comment.userId ? await getFriendlyUsername(comment.userId) : 'Anonymous User'
      }))
    );

    return enrichedComments;
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
) {
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
      // Enrich the new comment with the username
      return {
        ...result.data,
        friendlyUsername: await getFriendlyUsername(userId)
      };
    }

    return result.data;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

// Delete a comment
export async function deleteComment(commentId: string) {
  try {
    await client.models.Comment.delete({
      id: commentId
    });
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

// Edit a comment
export async function editComment(commentId: string, content: string) {
  try {
    const result = await client.models.Comment.update({
      id: commentId,
      content,
      updatedAt: new Date().toISOString()
    });

    if (result.data) {
      // Maintain the friendly username when updating
      return {
        ...result.data,
        friendlyUsername: await getFriendlyUsername(result.data.userId || '')
      };
    }

    return result.data;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
}