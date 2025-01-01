import { useState, useEffect } from 'react';
import { Search, UserPlus, Ban, Trophy, Activity, Users, X } from 'lucide-react';
import {
  acceptFriendRequest,
  getFriendsList,
  getPendingFriendRequests,
  removeFriend
} from './friendOperations';
import { getCurrentUser } from 'aws-amplify/auth';
import { useUser } from './userContext';
import FriendModal from './friendModal';
import './friends.css';
import { useUrlCache } from './urlCacheContext';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

interface FriendRequest {
  id: string;
  sender: string | null;
  senderUsername?: string | null;
  senderPicture?: string | null;
  recipient: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  createdAt: string | null;
}

interface Friend {
  userId: string;
  username: string;
  picture: string;
}

const ModernFriendsPage = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const { userId } = useUser();
  const { getStorageUrl } = useUrlCache(); // Use the hook inside the component body
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);


  const loadFriendsData = async () => {
    try {
      setLoading(true);
      const currentUser = userId || (await getCurrentUser()).userId;

      const friendsList = await getFriendsList(currentUser, getStorageUrl);
      const requests = await getPendingFriendRequests(currentUser);

      // Enhance requests with sender details
      const enhancedRequests = await Promise.all(
        requests.map(async (request) => {
          if (!request.sender) {
            return request;
          }

          // Fetch sender's user details
          const senderResult = await client.models.User.get({ id: request.sender });
          let senderUsername = 'Unknown User';
          let senderPicture = '/profileDefault.png';

          if (senderResult.data) {
            senderUsername = senderResult.data.preferred_username || senderResult.data.username || 'Unknown User';
            if (senderResult.data.picture) {
              try {
                senderPicture = await getStorageUrl(senderResult.data.picture);
              } catch (error) {
                console.error('Error fetching sender picture:', error);
              }
            }
          }

          return {
            ...request,
            senderUsername,
            senderPicture
          };
        })
      );

      setFriends(friendsList);
      setPendingRequests(enhancedRequests);
    } catch (err) {
      console.error('Error loading friends data:', err);
      setError('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriendsData();
  }, [userId]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      await loadFriendsData(); // Refresh the lists after accepting a request
    } catch (err) {
      console.error('Error accepting friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  const handleAddFriendSuccess = async () => {
    setIsAddFriendModalOpen(false);
    await loadFriendsData(); // Refresh the lists after adding a friend
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = pendingRequests.filter(request =>
    request.sender?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveFriend = async (friend: Friend) => {
    try {
      if (!userId) return;

      await removeFriend(userId, friend.userId);
      await loadFriendsData(); // Refresh the list
      setFriendToRemove(null); // Clear the confirmation dialog
    } catch (err) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div>Loading friends...</div>
      </div>
    );
  }

  return (
    <div className="friends-container">
      {/* Header Section */}
      <div className="friends-header">
        <div className="friends-header-top">
          <h1 className="friends-title">Friends</h1>
          <button
            onClick={() => setIsAddFriendModalOpen(true)}
            className="add-friend-button"
          >
            <UserPlus size={18} className="add-friend-button-icon" />
            Add Friend
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card--friends">
            <div className="stat-icon stat-icon--friends">
              <Users size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-info">
                <span className="stat-label">Total Friends</span>
                <span className="stat-value">{friends.length}</span>
              </div>
            </div>
          </div>

          <div className="stat-card stat-card--challenges">
            <div className="stat-icon stat-icon--challenges">
              <Trophy size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-info">
                <span className="stat-label">Pending Requests</span>
                <span className="stat-value">{pendingRequests.length}</span>
              </div>
            </div>
          </div>

          <div className="stat-card stat-card--active">
            <div className="stat-icon stat-icon--active">
              <Activity size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-info">
                <span className="stat-label">Active Now</span>
                <span className="stat-value">{Math.floor(friends.length * 0.3)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Add Friend Modal */}
      <FriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        onSuccess={handleAddFriendSuccess}
      />

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* Friends List */}
      <div className="friends-list">
        {/* Pending Requests */}
        {filteredRequests.map((request) => (
          <div key={request.id} className="friend-item friend-request">
            <div className="friend-info">
              <img
                src={request.senderPicture ?? "/profileDefault.png"}
                alt={request.senderUsername || "Friend request avatar"}
                className="friend-avatar"
              />
              <div className="friend-details">
                <h3 className="friend-name">{request.senderUsername}</h3>
                <p className="friend-status">Wants to connect</p>
              </div>
            </div>
            <div className="request-actions">
              <button
                onClick={() => handleAcceptRequest(request.id)}
                className="request-button request-button--accept"
              >
                Accept
              </button>
              <button className="request-button request-button--decline">
                Decline
              </button>
            </div>
          </div>
        ))}

        {/* Friends List */}
        {filteredFriends.map((friend) => (
          <div key={friend.userId} className="friend-item">
            <div className="friend-info">
              <img
                src={friend.picture}
                alt={`${friend.username}'s avatar`}
                className="friend-avatar"
              />
              <div className="friend-details">
                <h3 className="friend-name">{friend.username}</h3>
                <p className="friend-status">Friend</p>
              </div>
            </div>
            <div className="friend-actions">
              <button className="action-button action-button--remove"
                onClick={() => setFriendToRemove(friend)}
              >
                <Ban size={20} />
              </button>
            </div>
          </div>
        ))}

        {friendToRemove && (
          <div className="modal-overlay">
            <div className="confirmation-modal">
              <h3>Remove Friend</h3>
              <p>Are you sure you want to remove {friendToRemove.username} from your friends?</p>
              <div className="confirmation-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setFriendToRemove(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleRemoveFriend(friendToRemove)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Empty State */}
        {filteredFriends.length === 0 && filteredRequests.length === 0 && (
          <div className="empty-state">
            {searchTerm ? 'No results found' : 'No friends yet. Start adding some!'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernFriendsPage;
