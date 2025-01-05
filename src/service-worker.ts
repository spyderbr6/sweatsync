 
  // src/service-worker.ts
  /// <reference lib="webworker" />
  import { precacheAndRoute } from 'workbox-precaching';
  import { registerRoute } from 'workbox-routing';
  import { CacheFirst, NetworkFirst } from 'workbox-strategies';
  import { ExpirationPlugin } from 'workbox-expiration';
  import { NOTIFICATION_CONFIGS, NotificationConfig } from './types/notifications';
  
  declare const self: ServiceWorkerGlobalScope;
  
  // Precache all assets marked by your build tool
  precacheAndRoute(self.__WB_MANIFEST);
  
  // Cache the AWS Amplify API responses
  registerRoute(
    ({ url }) => url.href.includes('amazonaws.com'),
    new NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 // 1 hour
        })
      ]
    })
  );
  
  // Cache images
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        })
      ]
    })
  );

  // Define the NotificationAction interface
interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Extend the NotificationOptions interface to include actions
interface CustomNotificationOptions extends NotificationOptions {
  actions?: NotificationAction[];
  data?: any;
  vibrate?: number[];
  tag?: string;
  renotify?: boolean;
}

const CACHE_VERSION = '1.0.2';
const CACHE_NAME = `sweatsync-cache-v${CACHE_VERSION}`;

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('Service Worker activating.');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle push events
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    console.log('Push event received but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Parsed push data:', data);
    
    // Get notification config for this type
    const config: NotificationConfig = NOTIFICATION_CONFIGS[data.type] || NOTIFICATION_CONFIGS['DEFAULT'];

    const options: CustomNotificationOptions = {
      body: data.body,
      icon: config.icon,
      badge: config.badge,
      data: {
        ...data.data,
        type: data.type,
        url: config.urlPattern(data.data),
        config // Pass the full config to use in click handler
      },
      requireInteraction: config.requireInteraction,
      actions: config.actions,
      vibrate: config.vibrate,
      tag: `${data.type}-notification`,
      renotify: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
        .then(() => console.log('✅ Notification shown successfully'))
        .catch(error => {
          console.error('❌ Error showing notification:', error);
          console.error('Error details:', error);
        })
    );
  } catch (err) {
    console.error('Error processing push event:', err);
  }
});


// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // Get the notification data and config
  const notificationData = event.notification.data;
  const config = notificationData.config;

  // Determine which URL to use based on whether an action was clicked
  let targetUrl: string;
  
  if (event.action && config.actions) {
    // Add proper type for the action parameter
    const actionConfig = config.actions.find((a: NotificationAction) => a.action === event.action);
    targetUrl = actionConfig?.urlPattern 
      ? actionConfig.urlPattern(notificationData)
      : config.urlPattern(notificationData);
  } else {
    targetUrl = config.urlPattern(notificationData);
  }

  // Handle the navigation using self.clients instead of clients
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        return self.clients.openWindow(targetUrl);
      })
  );
});
