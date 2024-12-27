import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { inviteFriendToChallenge } from './challengeOperations';
import { getFriendsList } from './friendOperations';
import { useUrlCache } from './urlCacheContext';

const client = generateClient<Schema>();

interface InviteFriendsModalProps {
    isOpen: boolean;
    onClose: () => void;
    challengeId: string;
    onSuccess?: () => void;
}

interface FriendWithInviteStatus {
    userId: string;
    username: string;
    picture: string;
    inviteStatus: 'not_invited' | 'pending' | 'active' | 'completed' | 'dropped' | 'error';
}

const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
    isOpen,
    onClose,
    challengeId,
    onSuccess
}) => {
    const { userId } = useUser();
    const { getStorageUrl } = useUrlCache();
    const [friends, setFriends] = useState<FriendWithInviteStatus[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invitingFriend, setInvitingFriend] = useState<string | null>(null);

    // Filter friends based on search term
    const filteredFriends = friends.filter(friend =>
        friend.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (isOpen && userId) {
            loadFriends();
        }
    }, [isOpen, userId]);

    const loadFriends = async () => {
        if (!userId) return;

        try {
            setIsLoading(true);
            setError(null);

            // Get friends list
            const friendsList = await getFriendsList(userId, getStorageUrl);

            // Get all participations for this challenge with specific status filter
            const existingParticipants = await client.models.ChallengeParticipant.list({
                filter: {
                    challengeID: { eq: challengeId }
                }
            });

            // Create a map of user IDs to their participation status
            const participationMap = new Map(
                existingParticipants.data.map(p => [
                    p.userID,
                    {
                        status: p.status, // This will be 'ACTIVE', 'PENDING', 'COMPLETED', 'DROPPED'
                        id: p.id
                    }
                ])
            );

            // Convert to FriendWithInviteStatus
            const friendsWithStatus: FriendWithInviteStatus[] = friendsList.map(friend => {
                const participation = participationMap.get(friend.userId);

                let inviteStatus: FriendWithInviteStatus['inviteStatus'] = 'not_invited';

                if (participation) {
                    switch (participation.status) {
                        case 'ACTIVE':
                            inviteStatus = 'active';
                            break;
                        case 'PENDING':
                            inviteStatus = 'pending';
                            break;
                        case 'COMPLETED':
                            inviteStatus = 'completed';
                            break;
                        case 'DROPPED':
                            inviteStatus = 'dropped';
                            break;
                        default:
                            inviteStatus = 'not_invited';
                    }
                }

                return {
                    ...friend,
                    inviteStatus
                };
            });

            setFriends(friendsWithStatus);
        } catch (err) {
            console.error('Error loading friends:', err);
            setError('Failed to load friends list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInvite = async (friendId: string) => {
        if (!userId) return;

        try {
            setInvitingFriend(friendId);
            setError(null);

            const result = await inviteFriendToChallenge({
                challengeId,
                inviterId: userId,
                friendId
            });

            if (result.success) {
                // Update friend status in list
                setFriends(prev => prev.map(friend =>
                    friend.userId === friendId
                        ? { ...friend, inviteStatus: 'pending' }
                        : friend
                ));
            } else {
                // Update friend status to error
                setFriends(prev => prev.map(friend =>
                    friend.userId === friendId
                        ? { ...friend, inviteStatus: 'error' }
                        : friend
                ));
                setError(result.message);
            }

            onSuccess?.();
        } catch (err) {
            console.error('Error inviting friend:', err);
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setInvitingFriend(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                {/* Modal header */}
                <div className="modal-header">
                    <h2 className="modal-title">Invite Friends to Challenge</h2>
                    <button
                        onClick={onClose}
                        className="modal-close"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search input */}
                <div className="modal-search">
                    <div className="modal-search-container">
                        <Search size={20} className="modal-search-icon" />
                        <input
                            type="text"
                            className="modal-search-input"
                            placeholder="Search friends..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="modal-status modal-status--error">
                        {error}
                    </div>
                )}

                {/* Friends list */}
                <div className="modal-results">
                    {isLoading ? (
                        <div className="modal-loading">
                            Loading friends...
                        </div>
                    ) : filteredFriends.length > 0 ? (
                        filteredFriends.map(friend => (
                            <div key={friend.userId} className="result-item">
                                <div className="result-user">
                                    <img
                                        src={friend.picture}
                                        alt={friend.username}
                                        className="result-avatar"
                                    />
                                    <div className="result-info">
                                        <span className="result-name">
                                            {friend.username}
                                        </span>
                                        {/* Status indicators with inline styles */}
                                        {friend.inviteStatus === 'active' && (
                                            <span style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                marginTop: '0.25rem',
                                                color: '#10B981'
                                            }}>
                                                Currently Participating
                                            </span>
                                        )}
                                        {friend.inviteStatus === 'pending' && (
                                            <span style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                marginTop: '0.25rem',
                                                color: '#F59E0B'
                                            }}>
                                                Invitation Pending
                                            </span>
                                        )}
                                        {friend.inviteStatus === 'completed' && (
                                            <span style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                marginTop: '0.25rem',
                                                color: '#6366F1'
                                            }}>
                                                Challenge Completed
                                            </span>
                                        )}
                                        {friend.inviteStatus === 'dropped' && (
                                            <span style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                marginTop: '0.25rem',
                                                color: '#EF4444'
                                            }}>
                                                Dropped Out
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {(friend.inviteStatus === 'not_invited' || friend.inviteStatus === 'dropped') && (
                                    <button
                                        onClick={() => handleInvite(friend.userId)}
                                        disabled={invitingFriend === friend.userId}
                                        className="result-add-button"
                                    >
                                        <UserPlus size={16} />
                                        {invitingFriend === friend.userId
                                            ? 'Inviting...'
                                            : 'Invite'
                                        }
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="modal-empty">
                            {searchTerm ? 'No friends found' : 'No friends to invite'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InviteFriendsModal;