import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
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
        userID: { eq: userId },
        readAt: { attributeExists: false }
      }
    }).subscribe({
      next: async ({ items }) => {
        // Sort notifications by creation date, newest first
        const sortedNotifications = [...items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sortedNotifications);
        setUnreadCount(sortedNotifications.length);
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

      // Mark as read
      await client.models.Notification.update({
        id: notification.id,
        readAt: new Date().toISOString()
      });

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
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {visibleNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No new notifications
              </div>
            ) : (
              <>
                {visibleNotifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{notification.title}</p>
                        <p className="text-sm text-gray-600">{notification.body}</p>
                      </div>
                      {notification.createdAt && (
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="p-2 text-center">
                    <button
                      onClick={handleLoadMore}
                      className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                    >
                      Load More
                    </button>
                  </div>
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