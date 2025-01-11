import React, { useState, useRef } from 'react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";
import { SendHorizonal } from 'lucide-react';
import { useUser } from '../../userContext'; // Add this import

const client = generateClient<Schema>();

interface Friend {
    id: string;
    username: string;
}

interface SelectedMention {
    username: string;
    id: string;
  }

interface TaggableCommentInputProps {
    onSubmit: (content: string, taggedUserIds: string[]) => void;
    disabled?: boolean;
}

export const TaggableCommentInput: React.FC<TaggableCommentInputProps> = ({
    onSubmit,
    disabled = false
}) => {
    const { userId } = useUser(); // Add this line
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Friend[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedMentions, setSelectedMentions] = useState<SelectedMention[]>([]);


    // Get friends for suggestions
    const getFriendSuggestions = async (query: string) => {
        if (!userId) return; // Add null check

        try {
            // Get current user's friends
            const friendsResult = await client.models.Friend.list({
                filter: {
                    user: { eq: userId } // We'll need to get userId from context
                }
            });

            if (friendsResult.data) {
                // Get user details for each friend
                const friendPromises = friendsResult.data.map(async (friend) => {
                    const userResult = await client.models.User.get({ id: friend.friendUser });
                    if (userResult.data) {
                        return {
                            id: userResult.data.id,
                            username: userResult.data.preferred_username || userResult.data.username || ''
                        };
                    }
                    return null;
                });

                const friends = (await Promise.all(friendPromises))
                    .filter((friend): friend is Friend => friend !== null)
                    .filter(friend =>
                        friend.username.toLowerCase().includes(query.toLowerCase())
                    );

                setSuggestions(friends);
            }
        } catch (error) {
            console.error('Error fetching friend suggestions:', error);
            setSuggestions([]);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setCursorPosition(e.target.selectionStart || 0);

        // Check if we should show suggestions
        const lastAtSymbol = newValue.lastIndexOf('@', cursorPosition);
        if (lastAtSymbol !== -1) {
            const query = newValue.slice(lastAtSymbol + 1, cursorPosition).trim();
            if (query) {
                getFriendSuggestions(query);
                setShowSuggestions(true);
            } else {
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && suggestions.length > 0) {
          switch (e.key) {
            case 'Tab':
              e.preventDefault(); // Prevent moving focus
              insertMention(suggestions[selectedIndex]);
              break;
            case 'ArrowDown':
              e.preventDefault();
              setSelectedIndex(prev => (prev + 1) % suggestions.length);
              break;
            case 'ArrowUp':
              e.preventDefault();
              setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
              break;
            case 'Enter':
              e.preventDefault();
              insertMention(suggestions[selectedIndex]);
              break;
            case 'Escape':
              setShowSuggestions(false);
              break;
          }
        }
      };

    const insertMention = (friend: Friend) => {
        const lastAtSymbol = inputValue.lastIndexOf('@', cursorPosition);
        const newValue = 
          inputValue.slice(0, lastAtSymbol) + 
          `@[${friend.username}]` + 
          ' ' + 
          inputValue.slice(cursorPosition);
        
        setInputValue(newValue);
        setSelectedMentions(prev => [...prev, { username: friend.username, id: friend.id }]);
        setShowSuggestions(false);
        inputRef.current?.focus();
      };

      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
    
        const taggedUsers = new Set<string>();
        const regex = /@\[(.*?)\]/g;
        let match;
    
        while ((match = regex.exec(inputValue)) !== null) {
          const username = match[1];
          const mention = selectedMentions.find(m => m.username === username);
          if (mention) {
            taggedUsers.add(mention.id);
          }
        }
    
        const taggedArray = Array.from(taggedUsers);
        console.log('Tagged users array:', taggedArray);
        
        onSubmit(inputValue, taggedArray);
        setInputValue('');
        setSelectedMentions([]); // Clear mentions after submit
      };

    return (
        <form onSubmit={handleSubmit} className="comment-section__form">
            <div className="comment-input-container">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment... Use @ to tag friends"
                    className="comment-section__input"
                    disabled={disabled}
                />

                {showSuggestions && suggestions.length > 0 && (
                    <div className="friend-suggestions">
                        {suggestions.map((friend, index) => (
                            <div
                                key={friend.id}
                                className={`friend-suggestion ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => insertMention(friend)}
                            >
                                {friend.username}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={!inputValue.trim() || disabled}
                className="comment-section__submit"
            >
                <SendHorizonal size={16} />
            </button>
        </form>
    );
};