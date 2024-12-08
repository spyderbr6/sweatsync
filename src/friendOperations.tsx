import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Send a friend request
export async function sendFriendRequest(senderId: string, recipientId: string) {
  try {
    const result = await client.models.FriendRequest.create({
      sender: senderId,
      recipient: recipientId,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    return result;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
}

// Accept a friend request
export async function acceptFriendRequest(friendRequestId: string) {
  try {
    // First, fetch the friend request
    const friendRequestResult = await client.models.FriendRequest.get({ id: friendRequestId });
    
    if (!friendRequestResult.data) {
      throw new Error('Friend request not found');
    }

    const friendRequest = friendRequestResult.data;

    // Create friend entries for both users
    await client.models.Friend.create({
      user: friendRequest.sender,
      friendUser: friendRequest.recipient,
      friendshipDate: new Date().toISOString()
    });

    await client.models.Friend.create({
      user: friendRequest.recipient,
      friendUser: friendRequest.sender,
      friendshipDate: new Date().toISOString()
    });

    // Update friend request status
    await client.models.FriendRequest.update({
      id: friendRequestId,
      status: 'ACCEPTED'
    });

    return true;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
}

// Retrieve friends list
export async function getFriendsList(userId: string) {
  try {
    const friendsResult = await client.models.Friend.list({
      filter: {
        user: { eq: userId }
      }
    });

    // Directly map the result without accessing .items
    return friendsResult.data.map(friend => friend.friendUser);
  } catch (error) {
    console.error('Error retrieving friends list:', error);
    throw error;
  }
}

// Check if two users are friends
export async function areFriends(user1Id: string, user2Id: string) {
  try {
    const friendsResult = await client.models.Friend.list({
      filter: {
        user: { eq: user1Id },
        friendUser: { eq: user2Id }
      }
    });

    // Check the length of the result data directly
    return friendsResult.data.length > 0;
  } catch (error) {
    console.error('Error checking friendship:', error);
    throw error;
  }
}

// Get pending friend requests for a user
export async function getPendingFriendRequests(userId: string) {
  try {
    const requestsResult = await client.models.FriendRequest.list({
      filter: {
        recipient: { eq: userId },
        status: { eq: 'PENDING' }
      }
    });

    // Return the data directly
    return requestsResult.data;
  } catch (error) {
    console.error('Error retrieving pending friend requests:', error);
    throw error;
  }
}

