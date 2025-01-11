// src/components/NotificationBell/notificationBell.tsx
import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { useNavigate } from 'react-router-dom';
import { generateUrl } from '../../types/notifications';
import './NotificationBell.css'

const client = generateClient<Schema>();

interface NotificationBellProps {
  userId: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Schema["Notification"]["type"][]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(5); // Initial number of notifications to show
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const subscription = client.models.Notification.observeQuery({
      filter: {
        userID: { eq: userId }
      }
    }).subscribe({
      next: async ({ items }) => {
        // Sort notifications by creation date, newest first
        const sortedNotifications = [...items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sortedNotifications);
        // Count only unread notifications for the badge
        setUnreadCount(items.filter(n => !n.readAt).length);
      },
      error: (error) => console.error('Error fetching notifications:', error)
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  const handleNotificationClick = async (notification: Schema["Notification"]["type"]) => {
    if (!notification.id || !notification.type || !notification.data) return;

    try {
      // Parse the data JSON string
      const data = JSON.parse(notification.data);

      // Generate the target URL using the notification type and data
      const targetUrl = generateUrl(data.urlPattern || '', data);

      // Mark as read if not already read
      if (!notification.readAt) {
        await client.models.Notification.update({
          id: notification.id,
          readAt: new Date().toISOString()
        });
      }

      // Navigate to the target URL
      navigate(targetUrl);

      // Close the notification panel
      setIsOpen(false);
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 5); // Load 5 more notifications
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Get visible notifications
  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = visibleCount < notifications.length;

  return (
    <div className="header-notifications">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="notification-button"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3 className="notification-title">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="notification-close-button"
              aria-label="Close notifications"
            >
              <X size={20} />
            </button>
          </div>

          <div className="notification-list">
            {visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                No new notifications
              </div>
            ) : (
              <>
                {visibleNotifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`notification-item ${notification.readAt ? 'notification-item--read' : ''} 
                              ${notification.status === 'PENDING' ? 'notification-item--pending' : ''}`}
                  >
                    <div className="notification-content">
                      <div className="notification-message">
                        <span className="notification-title">{notification.title}</span>
                        {notification.status === 'PENDING' && (
                          <span className="notification-status">Action Required</span>
                        )}
                      </div>
                      <p className="notification-message">{notification.body}</p>
                      <div className="notification-meta">
                        <span className="notification-time">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        {notification.readAt && (
                          <span className="notification-read-status">Read</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    className="load-more-button"
                  >
                    Load More
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;