import { useState, useEffect } from 'react';
import { Search, UserPlus, UserMinus, MessageCircle, X } from 'lucide-react';
import { 
  sendFriendRequest, 
  acceptFriendRequest, 
  getFriendsList, 
  getPendingFriendRequests 
} from './friendOperations';
import { getCurrentUser } from 'aws-amplify/auth';
import './friends.css';  // Make sure to create this CSS file


type Nullable<T> = T | null;

interface FriendRequest {
  id: string;
  sender: Nullable<string>;
  recipient: Nullable<string>;
  status: Nullable<'PENDING' | 'ACCEPTED' | 'DECLINED'>;
  createdAt: Nullable<string>;
  updatedAt: string;
}

interface User {
  userId: string;
  username: string;
}

const FriendsPage = () => {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchTerm, setSearchTerm] = useState('');
  // Updated type to handle nullable strings, but filter out nulls when setting
  const [friends, setFriends] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndFriends = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        setCurrentUser(user);

        const friendsList = await getFriendsList(user.userId);
        // Filter out null values before setting the state
        setFriends(friendsList.filter((friend): friend is string => friend !== null));

        const requests = await getPendingFriendRequests(user.userId);
        setPendingRequests(requests);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching friends:', err);
        setError('Failed to load friends');
        setLoading(false);
      }
    };

    fetchUserAndFriends();
  }, []);

  const handleSendFriendRequest = async () => {
    if (!newFriendEmail || !currentUser) return;

    try {
      await sendFriendRequest(currentUser.userId, newFriendEmail);
      setNewFriendEmail('');
      setIsAddFriendModalOpen(false);
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      if (currentUser) {
        const updatedFriends = await getFriendsList(currentUser.userId);
        // Filter out null values before setting the state
        setFriends(updatedFriends.filter((friend): friend is string => friend !== null));
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  // Filtering logic (no need to check for null since we filtered them out)
  const filteredFriends = friends.filter(friend => 
    friend.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = pendingRequests.filter(request => 
    request.sender?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading friends...</p>
      </div>
    );
  }

  return (
    <div className="friends-container">
      {/* Header */}
      <div className="friends-header">
        <h1 className="friends-title">Friends</h1>
        <div>
          <button 
            className="add-friend-button"
            onClick={() => setIsAddFriendModalOpen(true)}
            title="Add Friend"
          >
            <UserPlus size={24} />
          </button>
        </div>
      </div>

      {/* Add Friend Modal */}
      {isAddFriendModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <button 
              onClick={() => setIsAddFriendModalOpen(false)}
              className="modal-close"
            >
              <X size={24} />
            </button>
            <h2 className="modal-title">Add Friend</h2>
            <input 
              type="email"
              placeholder="Enter friend's email"
              className="modal-input"
              value={newFriendEmail}
              onChange={(e) => setNewFriendEmail(e.target.value)}
            />
            <button 
              onClick={handleSendFriendRequest}
              className="modal-button"
            >
              Send Friend Request
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-wrapper">
          <input 
            type="text" 
            placeholder="Search friends" 
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="search-icon" size={20} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends
        </button>
        <button 
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <span 
            className="error-close"
            onClick={() => setError(null)}
          >
            <X size={20} />
          </span>
        </div>
      )}

      {/* Friends List or Requests List */}
      <div className="list-container">
        {activeTab === 'friends' ? (
          filteredFriends.length > 0 ? (
            filteredFriends.map(friend => (
              <div key={friend} className="list-item">
                <img 
                  src={`/api/placeholder/80/80`} 
                  alt={friend} 
                  className="profile-image"
                />
                <div className="friend-info">
                  <p className="friend-name">{friend}</p>
                </div>
                <div className="action-buttons">
                  <button className="icon-button">
                    <MessageCircle size={20} />
                  </button>
                  <button className="icon-button remove-button">
                    <UserMinus size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No friends yet. Start adding some!
            </div>
          )
        ) : (
          filteredRequests.length > 0 ? (
            filteredRequests.map(request => (
              <div key={request.id} className="list-item">
                <img 
                  src={`/api/placeholder/80/80`} 
                  alt={request.sender || 'Unknown user'} 
                  className="profile-image"
                />
                <div className="friend-info">
                  <p className="friend-name">{request.sender || 'Unknown user'}</p>
                  <p className="friend-status">Wants to be your friend</p>
                </div>
                <div className="action-buttons">
                  <button 
                    className="accept-button"
                    onClick={() => handleAcceptRequest(request.id)}
                  >
                    Accept
                  </button>
                  <button className="decline-button">
                    Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No pending friend requests
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default FriendsPage;