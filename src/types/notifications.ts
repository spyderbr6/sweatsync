// src/types/notifications.ts

// Define URL pattern handler type
type URLPatternHandler = (data: Record<string, any>) => string;

// Enhanced notification configuration type
export interface NotificationConfig {
  icon: string;
  badge: string;
  urlPattern: URLPatternHandler;
  actions?: {
    title: string;
    action: string;
    icon?: string;
    urlPattern?: URLPatternHandler; // Optional different URL for specific actions
  }[];
  requireInteraction: boolean;
  vibrate: number[];
}

export const NOTIFICATION_CONFIGS: Record<string, NotificationConfig> = {
  CHALLENGE_INVITE: {
    icon: '/icons/challenge-invite.png',
    badge: '/icons/badge-challenge.png',
    urlPattern: (data) => `/challenge/${data.challengeId}`,
    actions: [
      { 
        title: 'View', 
        action: 'view'
        // Uses default urlPattern
      },
      { 
        title: 'Accept', 
        action: 'accept',
        urlPattern: (data) => `/challenge/${data.challengeId}/accept`
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  },
  COMMENT: {
    icon: '/icons/comment.png',
    badge: '/icons/badge-comment.png',
    urlPattern: (data) => `/post/${data.postId}#comment-${data.commentId}`,
    actions: [
      { 
        title: 'View', 
        action: 'view'
      },
      { 
        title: 'Reply', 
        action: 'reply',
        urlPattern: (data) => `/post/${data.postId}/reply/${data.commentId}`
      }
    ],
    requireInteraction: false,
    vibrate: [100, 50, 100]
  },
  FRIEND_REQUEST: {
    icon: '/icons/friend-request.png',
    badge: '/icons/badge-friend.png',
    urlPattern: (data) => `/friends/requests/${data.userId}`,
    actions: [
      { 
        title: 'View Profile', 
        action: 'view',
        urlPattern: (data) => `/profile/${data.userId}`
      },
      { 
        title: 'Accept', 
        action: 'accept',
        urlPattern: (data) => `/friends/accept/${data.userId}`
      }
    ],
    requireInteraction: true,
    vibrate: [150, 75, 150]
  },
  // This is a daily challenge notification. There is no call to action as you must accept daily challenges from your group challenge.
  CHALLENGE_DAILY_ADDED: {
    icon: '/icons/daily-challenge.png',
    badge: '/icons/badge-daily.png',
    urlPattern: (data) => `/challenge/${data.challengeId}`,
    actions: [
      { 
        title: 'View', 
        action: 'view'
      }
    ],
    requireInteraction: true,
    vibrate: [150, 75, 150]
  }
};