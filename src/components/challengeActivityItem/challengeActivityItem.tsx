// src/components/ActivityItem.tsx
import React from 'react';
import { Heart, MessageCircle, Clock, Medal, ExternalLink } from 'lucide-react';
import type { ActivityEntry } from '../../challengeTypes';
import './challengeActivityStyle.css'

interface ActivityItemProps {
  item: ActivityEntry;
  profileUrl: string;
  workoutUrl: string;
  navigate: (path: string) => void;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ 
  item, 
  profileUrl, 
  workoutUrl,
  navigate 
}) => {
  return (
    <div className="activity-item">
      {/* Header */}
      <div className="activity-item__header">
        <img
          src={profileUrl}
          alt={item.username}
          className="activity-item__avatar"
        />
        <div className="activity-item__user-info">
          <div className="activity-item__username-row">
            <span className="activity-item__username">
              {item.username}
            </span>
            {item.isDaily && (
              <span className="activity-item__daily-badge">
                Daily
              </span>
            )}
          </div>
          <div className="activity-item__timestamp">
            <Clock className="w-3 h-3 mr-1" />
            <time>{new Date(item.timestamp).toLocaleDateString()}</time>
          </div>
        </div>
      </div>

      {/* Content + Thumbnail */}
      <div className="activity-item__content-wrapper">
        <div className="activity-item__content">
          {item.isDaily && (
            <h3 
              onClick={() => navigate(`/post/${item.id}`)}
              className="activity-item__challenge-title"
            >
              {item.challengeTitle}
            </h3>
          )}
          <p className="activity-item__text">{item.content}</p>
        </div>
        
        {item.workoutImage && (
          <div 
            className="activity-item__thumbnail-wrapper"
            onClick={() => navigate(`/post/${item.id}`)}
          >
            <img
              src={workoutUrl}
              alt="Workout"
              className="activity-item__thumbnail"
            />
            <div className="activity-item__thumbnail-overlay">
              <ExternalLink 
                className="activity-item__thumbnail-icon" 
                size={20} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="activity-item__footer">
        <div className="activity-item__actions">
          <div className="activity-item__points">
            <Medal className="w-4 h-4 mr-1" />
            <span>+{item.points}</span>
          </div>
          <button className="activity-item__action-button activity-item__action-button--like">
            <Heart className="w-4 h-4" />
            <span className="activity-item__action-count">{item.likes}</span>
          </button>
          <button className="activity-item__action-button">
            <MessageCircle className="w-4 h-4" />
            <span className="activity-item__action-count">{item.comments}</span>
          </button>
        </div>
        <button 
          onClick={() => navigate(`/post/${item.id}`)}
          className="activity-item__view-button"
        >
          View →
        </button>
      </div>
    </div>
  );
};