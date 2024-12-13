import { useState, useEffect } from 'react';
import { Search, UserPlus, MessageCircle, Ban, Trophy, Activity, Users, X } from 'lucide-react';
import {
  acceptFriendRequest,
  getFriendsList,
  getPendingFriendRequests
} from './friendOperations';
import { getCurrentUser } from 'aws-amplify/auth';
import { useUser } from './userContext';
import FriendModal from './friendModal';
import './friends.css';


interface FriendRequest {
  id: string;
  sender: string | null;
  recipient: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  createdAt: string | null;
}

const ModernFriendsPage = () => {
  const [friends, setFriends] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const { userId } = useUser();

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      if (!userId) {
        const user = await getCurrentUser();
        const friendsList = await getFriendsList(user.userId);
        const requests = await getPendingFriendRequests(user.userId);
        
        setFriends(friendsList.filter((friend): friend is string => friend !== null));
        setPendingRequests(requests);
      } else {
        const friendsList = await getFriendsList(userId);
        const requests = await getPendingFriendRequests(userId);
        
        setFriends(friendsList.filter((friend): friend is string => friend !== null));
        setPendingRequests(requests);
      }
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
      // Refresh friends and requests lists
      if (userId) {
        const friendsList = await getFriendsList(userId);
        const requests = await getPendingFriendRequests(userId);

        setFriends(friendsList.filter((friend): friend is string => friend !== null));
        setPendingRequests(requests);
      }
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
    friend.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = pendingRequests.filter(request =>
    request.sender?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Users className="stat-icon stat-icon--friends" />
            <div className="stat-content">
              <p className="stat-label">Total Friends</p>
              <p className="stat-value">{friends.length}</p>
            </div>
          </div>
          <div className="stat-card stat-card--challenges">
            <Trophy className="stat-icon stat-icon--challenges" />
            <div className="stat-content">
              <p className="stat-label">Pending Requests</p>
              <p className="stat-value">{pendingRequests.length}</p>
            </div>
          </div>
          <div className="stat-card stat-card--active">
            <Activity className="stat-icon stat-icon--active" />
            <div className="stat-content">
              <p className="stat-label">Active Now</p>
              <p className="stat-value">{Math.floor(friends.length * 0.3)}</p>
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
                src="/profileDefault.png"
                alt="Friend request avatar"
                className="friend-avatar"
              />
              <div className="friend-details">
                <h3 className="friend-name">{request.sender}</h3>
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
          <div key={friend} className="friend-item">
            <div className="friend-info">
              <img
                src="/profileDefault.png"
                alt={`${friend}'s avatar`}
                className="friend-avatar"
              />
              <div className="friend-details">
                <h3 className="friend-name">{friend}</h3>
                <p className="friend-status">Friend</p>
              </div>
            </div>
            <div className="friend-actions">
              <button className="action-button action-button--message">
                <MessageCircle size={20} />
              </button>
              <button className="action-button action-button--remove">
                <Ban size={20} />
              </button>
            </div>
          </div>
        ))}

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