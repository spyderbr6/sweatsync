import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";


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

    // Ensure sender and recipient are non-null
    if (!friendRequest.sender || !friendRequest.recipient) {
      console.error('Invalid friend request: sender or recipient is null');
      throw new Error('Invalid friend request: sender or recipient is null');
    }

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

// friendOperations.tsx

export async function getFriendsList(userId: string, getStorageUrl: (path: string) => Promise<string>) {
  console.log('Fetching friends list for user:', userId);

  try {
    const friendsResult = await client.models.Friend.list({
      filter: { user: { eq: userId } }
    });

    const friendDetails = await Promise.all(
      friendsResult.data.map(async (friend) => {
        if (!friend.friendUser) {
          console.warn(`Invalid friend entry with null friendUser: ${friend.id}`);
          return null;
        }

        try {
          const userResult = await client.models.User.get({ id: friend.friendUser });

          let profilePictureUrl = '/profileDefault.png';
          if (userResult.data?.picture) {
            profilePictureUrl = await getStorageUrl(userResult.data.picture);
          }

          return {
            userId: friend.friendUser,
            username: userResult.data?.preferred_username || userResult.data?.username || 'Unknown User',
            picture: profilePictureUrl,
          };
        } catch (error) {
          console.error(`Error fetching user details for friend ${friend.friendUser}:`, error);
          return {
            userId: friend.friendUser,
            username: 'Unknown User',
            picture: '/profileDefault.png',
          };
        }
      })
    );

    return friendDetails.filter((friend) => friend !== null);
  } catch (error) {
    console.error('Error in getFriendsList:', error);
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
  currentUserId: string,
  getStorageUrl: (path: string) => Promise<string> // Pass getStorageUrl as a parameter
): Promise<UserSearchResult[]> {
  try {
    let filter = {};
    if (searchType === 'email') {
      filter = {
        email: { contains: searchTerm.toLowerCase() }
      };
    } else {
      filter = {
        or: [
          { username: { contains: searchTerm.toLowerCase() } },
          { preferred_username: { contains: searchTerm.toLowerCase() } }
        ]
      };
    }

    const results = await client.models.User.list({ filter });

    // Get mutual friends count for each user
    const usersWithMutualFriends = await Promise.all(
      results.data
        .filter(user => user.id !== currentUserId) // Exclude current user
        .map(async user => ({
          userId: user.id,
          username: user.preferred_username || user.username,
          email: user.email || null,
          mutualFriends: await getMutualFriendCount(currentUserId, user.id, getStorageUrl) // Pass getStorageUrl here
        }))
    );

    return usersWithMutualFriends;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}


// Helper function to calculate mutual friends
export async function getMutualFriendCount(
  user1Id: string,
  user2Id: string,
  getStorageUrl: (path: string) => Promise<string>
): Promise<number> {
  try {
    const user1Friends = await getFriendsList(user1Id, getStorageUrl);
    const user2Friends = await getFriendsList(user2Id, getStorageUrl);

    const user1FriendIds = new Set(user1Friends.map(friend => friend.userId));
    const mutualFriends = user2Friends.filter(friend => user1FriendIds.has(friend.userId));

    return mutualFriends.length;
  } catch (error) {
    console.error('Error calculating mutual friends:', error);
    return 0;
  }
}

