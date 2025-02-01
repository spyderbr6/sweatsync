import React, { useState, useEffect, useRef } from 'react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";
import { useNavigate } from 'react-router-dom';
import { generateUrl, NOTIFICATION_CONFIGS } from '../../types/notifications';
import './NotificationBell.css';

interface NotificationBellProps {
  userId: string;
  position?: 'bottom' | 'top';
  /** Whether the notification panel is currently open. */
  isOpen?: boolean;
  /** Called whenever the unread count changes. */
  onUnreadCountChange?: (count: number) => void;
  /**
   * Called by the panel itself when it detects a click
   * outside of its DOM. The parent (BottomNav) should
   * toggle `isOpen` back to false in response.
   */
  onRequestClose?: () => void;
}

const client = generateClient<Schema>();

const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  position = 'top',
  isOpen = false,
  onUnreadCountChange,
  onRequestClose
}) => {
  const [notifications, setNotifications] = useState<Schema["Notification"]["type"][]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const navigate = useNavigate();
  /** Ref for the notification panel wrapper. */
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications + track unread count
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

        // Update unread count
        const unreadCount = items.filter(n => !n.readAt).length;
        onUnreadCountChange?.(unreadCount);
      },
      error: (error) => console.error('Error fetching notifications:', error)
    });

    return () => subscription.unsubscribe();
  }, [userId, onUnreadCountChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // If panelRef exists and click is outside of that container:
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onRequestClose?.();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onRequestClose]);

  // Don't render if panel is closed
  if (!isOpen) return null;

  // Handlers
  const handleNotificationClick = async (notification: Schema["Notification"]["type"]) => {
    if (!notification.id) return;

    try {
      // Mark as read if not already read
      if (!notification.readAt) {
        await client.models.Notification.update({
          id: notification.id,
          readAt: new Date().toISOString()
        });
      }

      // Get the notification config for this type
      if (!notification.type) {
        console.error('No notification type provided');
        return;
      }

      const config = NOTIFICATION_CONFIGS[notification.type];
      if (!config) {
        console.error('No config found for notification type:', notification.type);
        return;
      }

      // Parse notification data & navigate
      if (notification.data) {
        try {
          const data = JSON.parse(notification.data);
          const targetUrl = generateUrl(config.urlPattern, data);
          navigate(targetUrl);
        } catch (parseError) {
          console.error('Error parsing notification data:', {
            error: parseError,
            data: notification.data,
            type: notification.type
          });
        }
      } else {
        // No data -> direct to config URL
        navigate(config.urlPattern);
      }
    } catch (error) {
      console.error('Error handling notification:', {
        error,
        notificationId: notification.id,
        type: notification.type
      });
    }
  };

  const handleLoadMore = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don’t bubble up
    setVisibleCount(prev => prev + 5);
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

  // Slicing notifications for "Load More"
  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = visibleCount < notifications.length;

  return (
    <div
      ref={panelRef}
      className={`notification-panel ${
        position === 'bottom' ? 'notification-panel--bottom' : ''
      }`}
    >
      <div className="notification-header">
        <h3 className="notification-title">Notifications</h3>
      </div>

      <div className="notification-list">
        {visibleNotifications.length === 0 ? (
          <div className="notification-empty">No new notifications</div>
        ) : (
          <>
            {visibleNotifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`notification-item ${
                  notification.readAt ? 'notification-item--read' : ''
                } ${notification.status === 'PENDING' ? 'notification-item--pending' : ''}`}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleNotificationClick(notification);
                  }
                }}
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
              <div
                onClick={handleLoadMore}
                className="load-more-button"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLoadMore;
                  }
                }}
              >
                Load More
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationBell;
