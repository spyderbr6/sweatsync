import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { fetchUserAttributes } from 'aws-amplify/auth';


const client = generateClient<Schema>();

// Send a friend request
export async function sendFriendRequest(senderId: string, recipientId: string) {
  console.log('Attempting to send friend request:', { senderId, recipientId });
  try {
    // Check for existing requests in either direction
    const existingRequests = await client.models.FriendRequest.list({
      filter: {
        or: [
          {
            and: [
              { sender: { eq: senderId } },
              { recipient: { eq: recipientId } },
              { status: { eq: 'PENDING' } }
            ]
          },
          {
            and: [
              { sender: { eq: recipientId } },
              { recipient: { eq: senderId } },
              { status: { eq: 'PENDING' } }
            ]
          }
        ]
      }
    });

    if (existingRequests.data.length > 0) {
      console.log('Friend request already exists');
      throw new Error('A pending friend request already exists between these users');
    }

    // Create the friend request
    const result = await client.models.FriendRequest.create({
      sender: senderId,
      recipient: recipientId,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    console.log('Friend request created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in sendFriendRequest:', error);
    const typedError = error as Error;
    if (typedError.message.includes('not authorized')) {
      throw new Error('You must be logged in to send friend requests.');
    }
    throw error;
  }
}

// Accept a friend request
export async function acceptFriendRequest(friendRequestId: string) {
  console.log('Attempting to accept friend request:', friendRequestId);
  try {
    // Get the friend request
    const friendRequestResult = await client.models.FriendRequest.get({ id: friendRequestId });
    
    if (!friendRequestResult.data) {
      console.error('Friend request not found:', friendRequestId);
      throw new Error('Friend request not found');
    }

    const friendRequest = friendRequestResult.data;
    console.log('Found friend request:', friendRequest);

    // Update friend request status first
    const updateResult = await client.models.FriendRequest.update({
      id: friendRequestId,
      status: 'ACCEPTED'
    });
    console.log('Updated friend request status:', updateResult);

    // Create mutual friend entries
    const friendEntries = await Promise.all([
      client.models.Friend.create({
        user: friendRequest.sender,
        friendUser: friendRequest.recipient,
        friendshipDate: new Date().toISOString()
      }),
      client.models.Friend.create({
        user: friendRequest.recipient,
        friendUser: friendRequest.sender,
        friendshipDate: new Date().toISOString()
      })
    ]);
    
    console.log('Created friend entries:', friendEntries);
    return true;
  } catch (error) {
    console.error('Error in acceptFriendRequest:', error);
    const typedError = error as Error;
    if (typedError.message.includes('not authorized')) {
      throw new Error('You must be logged in to accept friend requests.');
    }
    throw error;
  }
}

// Get pending friend requests
export async function getPendingFriendRequests(userId: string) {
  console.log('Fetching pending friend requests for user:', userId);
  try {
    const requestsResult = await client.models.FriendRequest.list({
      filter: {
        recipient: { eq: userId },
        status: { eq: 'PENDING' }
      }
    });

    console.log('Fetched pending requests:', requestsResult);
    return requestsResult.data;
  } catch (error) {
    console.error('Error in getPendingFriendRequests:', error);
    const typedError = error as Error;
    if (typedError.message.includes('not authorized')) {
      throw new Error('You must be logged in to view friend requests.');
    }
    throw error;
  }
}

// Get friends list
export async function getFriendsList(userId: string) {
  console.log('Fetching friends list for user:', userId);
  try {
    const friendsResult = await client.models.Friend.list({
      filter: {
        user: { eq: userId }
      }
    });

    console.log('Fetched friends list:', friendsResult);
    return friendsResult.data.map(friend => friend.friendUser);
  } catch (error) {
    console.error('Error in getFriendsList:', error);
    const typedError = error as Error;
    if (typedError.message.includes('not authorized')) {
      throw new Error('You must be logged in to view your friends list.');
    }
    throw error;
  }
}

// New function to check friend request status
export async function checkFriendRequestStatus(userId: string, otherUserId: string) {
  try {
    const requests = await client.models.FriendRequest.list({
      filter: {
        or: [
          {
            and: [
              { sender: { eq: userId } },
              { recipient: { eq: otherUserId } }
            ]
          },
          {
            and: [
              { sender: { eq: otherUserId } },
              { recipient: { eq: userId } }
            ]
          }
        ]
      }
    });

    return requests.data[0] || null;
  } catch (error) {
    console.error('Error checking friend request status:', error);
    throw error;
  }
}

interface UserSearchResult {
  userId: string;
  username: string | null;
  email: string | null;
  mutualFriends?: number;
}

export async function searchUsers(
  searchTerm: string, 
  searchType: 'email' | 'username',
 // currentUserId: string
): Promise<UserSearchResult[]> {
  try {
    // Get current user's friends list for mutual friends calculation
    //const currentUserFriends = await getFriendsList(currentUserId);
    //const friendSet = new Set(currentUserFriends);

    // Get user attributes for all users
    const allUsersAttrs = await fetchUserAttributes();

    // Search for users based on search type
    if (searchType === 'email') {
      // Search by email - this should be replaced with your actual user search implementation
      // For now, we're simulating a search through user attributes
      if (allUsersAttrs.email?.includes(searchTerm)) {
        return [{
          userId: allUsersAttrs.sub || '',
          username: allUsersAttrs.preferred_username || null,
          email: allUsersAttrs.email || null,
          mutualFriends: 0 // Calculate based on friend lists
        }];
      }
    } else {
      // Search by username
      if (allUsersAttrs.preferred_username?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return [{
          userId: allUsersAttrs.sub || '',
          username: allUsersAttrs.preferred_username || null,
          email: allUsersAttrs.email || null,
          mutualFriends: 0 // Calculate based on friend lists
        }];
      }
    }

    return [];
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

// Helper function to calculate mutual friends
export async function getMutualFriendCount(user1Id: string, user2Id: string): Promise<number> {
  try {
    const user1Friends = await getFriendsList(user1Id);
    const user2Friends = await getFriendsList(user2Id);

    const user1FriendSet = new Set(user1Friends);
    const mutualFriends = user2Friends.filter(friend => user1FriendSet.has(friend));

    return mutualFriends.length;
  } catch (error) {
    console.error('Error calculating mutual friends:', error);
    return 0;
  }
}