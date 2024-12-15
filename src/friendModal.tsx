import React, { useState, useEffect } from 'react';
import { Search, Mail, AtSign, X, UserPlus, Users } from 'lucide-react';
import { sendFriendRequest, searchUsers } from './friendOperations';
import { useUser } from './userContext';
import './friends.css';
import { useUrlCache } from './urlCacheContext';


interface FriendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface SearchResult {
    userId: string;
    username: string | null;
    email: string | null;
    mutualFriends: number;  // Make this required, not optional
    picture?: string | null;
}

const FriendModal: React.FC<FriendModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { userId } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'email' | 'username'>('username');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
    const { getStorageUrl } = useUrlCache();

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);


    // Perform search when debounced term changes
    useEffect(() => {
        // In FriendModal.tsx
        const performSearch = async () => {
            if (!userId || !debouncedTerm || debouncedTerm.length < 2) {
                setSearchResults([]);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                if (searchType === 'email') {
                    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedTerm);
                    if (isValidEmail) {
                        setSearchResults([{
                            userId: debouncedTerm,
                            username: null,
                            email: debouncedTerm,
                            mutualFriends: 0    // Always provide a value
                        }]);
                    } else {
                        setSearchResults([]);
                    }
                } else {
                    // When handling the results from searchUsers
                    const results = await searchUsers(debouncedTerm, searchType, userId, getStorageUrl);
                    // Ensure mutualFriends is always defined
                    const formattedResults: SearchResult[] = results.map(user => ({
                        ...user,
                        mutualFriends: user.mutualFriends || 0  // Default to 0 if undefined
                    }));
                    setSearchResults(formattedResults);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to search users');
                setSearchResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedTerm, searchType, userId]);

    const handleSendRequest = async (recipientId: string) => {
        if (!userId) return;

        try {
            setIsLoading(true);
            setError(null);
            await sendFriendRequest(userId, recipientId);
            setSuccess('Friend request sent successfully!');
            onSuccess?.();

            // Remove the user from search results
            setSearchResults(prev => prev.filter(user => user.userId !== recipientId));

            // Reset success message after 3 seconds
            setTimeout(() => {
                setSuccess(null);
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send friend request');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                {/* Modal header section */}
                <div className="modal-header">
                    <h2 className="modal-title">Add Friends</h2>
                    <button
                        onClick={onClose}
                        className="modal-close"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search type tabs */}
                <div className="search-type-tabs">
                    <button
                        className={`search-type-tab ${searchType === 'username' ? 'search-type-tab--active' : ''}`}
                        onClick={() => setSearchType('username')}
                    >
                        <AtSign size={16} className="search-type-icon" />
                        Username
                    </button>
                    <button
                        className={`search-type-tab ${searchType === 'email' ? 'search-type-tab--active' : ''}`}
                        onClick={() => setSearchType('email')}
                    >
                        <Mail size={16} className="search-type-icon" />
                        Email
                    </button>

                </div>

                {/* Search input */}
                <div className="modal-search">
                    <div className="modal-search-container">
                        <Search size={20} className="modal-search-icon" />
                        <input
                            type={searchType === 'email' ? 'email' : 'text'}
                            className="modal-search-input"
                            placeholder={`Search by ${searchType}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            minLength={2}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="modal-search-clear"
                                aria-label="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Status messages */}
                {error && (
                    <div className="modal-status modal-status--error">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="modal-status modal-status--success">
                        {success}
                    </div>
                )}

                {/* Search results */}
                <div className="modal-results">
                    <h3 className="results-title">
                        {searchTerm ? 'Search Results' : 'Enter a search term'}
                    </h3>

                    {isLoading ? (
                        <div className="modal-loading">
                            Searching for users...
                        </div>
                    ) : searchResults.length > 0 ? (
                        searchResults.map(user => (
                            <div key={user.userId} className="result-item">
                                <div className="result-user">
                                    <img
                                        src={user.picture || "/profileDefault.png"}
                                        alt={user.username || 'User'}
                                        className="result-avatar"
                                    />
                                    <div className="result-info">
                                        {/* Always show username, never show email */}
                                        <span className="result-name">
                                            {user.username || 'Anonymous User'}
                                        </span>

                                        {/* Conditional meta information */}
                                        <div className="result-meta">
                                            {searchType === 'email' ? (
                                                <span>Found via email search</span>
                                            ) : (
                                                <div className="result-meta">
                                                    <Users size={14} />
                                                    <span>{user.mutualFriends} mutual friends</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSendRequest(user.userId)}
                                    disabled={isLoading}
                                    className="result-add-button"
                                >
                                    <UserPlus size={16} />
                                    Add
                                </button>
                            </div>
                        ))
                    ) : searchTerm.length >= 2 ? (
                        <div className="modal-empty">
                            No users found
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default FriendModal;