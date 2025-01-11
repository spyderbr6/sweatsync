// src/types/notifications.ts

export interface NotificationConfig {
  icon: string;
  badge: string;
  urlPattern: string; // Changed to string pattern
  actions?: {
    title: string;
    action: string;
    icon?: string;
    urlPattern?: string; // Changed to string pattern
  }[];
  requireInteraction: boolean;
  vibrate: number[];
}

// Helper function to generate URLs (moved to runtime)
export function generateUrl(pattern: string, data: Record<string, any>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key) => data[key] || '');
}

export const NOTIFICATION_CONFIGS: Record<string, NotificationConfig> = {
  CHALLENGE_INVITE: {
    icon: '/icons/icon-192.png',
    badge: '/icons/trophy-96.png',
    urlPattern: '/challenge/{challengeId}',
    actions: [
      { 
        title: 'View', 
        action: 'view'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  },
  COMMENT_ON_POST: {
    icon: '/icons/icon-192.png',
    badge: '/icons/message-circle-96.png',
    urlPattern: '/post/{postId}',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'viewComment',
        title: 'View Comment',
        urlPattern: '/post/{postId}'
      }
    ]
  },
  USER_TAGGED: {
    icon: '/icons/icon-192.png',
    badge: '/icons/at-sign-96.png',
    urlPattern: '/post/{postId}',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'viewTag',
        title: 'View Post',
        urlPattern: '/post/{postId}'
      }
    ]
  },
  FRIEND_REQUEST: {
    icon: '/icons/icon-192.png',
    badge: '/icons/userplus-96.png',
    urlPattern: '/friends',
    actions: [
      { 
        title: 'View', 
        action: 'view'
      }
    ],
    requireInteraction: true,
    vibrate: [150, 75, 150]
  },
  CHALLENGE_DAILY_ADDED: {
    icon: '/icons/icon-192.png',
    badge: '/icons/flame-96.png',
    urlPattern: '/challenge/{challengeId}',
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