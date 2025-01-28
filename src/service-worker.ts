 
  // src/service-worker.ts
  /// <reference lib="webworker" />
  import { precacheAndRoute } from 'workbox-precaching';
  import { registerRoute } from 'workbox-routing';
  import { CacheFirst, NetworkFirst } from 'workbox-strategies';
  import { ExpirationPlugin } from 'workbox-expiration';
  import { NOTIFICATION_CONFIGS} from './types/notifications';
  
  declare const self: ServiceWorkerGlobalScope;

  const DEBUG = true; // We can disable this in production later
const log = (...args: any[]) => DEBUG && console.log('[ServiceWorker]', ...args);

  // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  const CACHE_VERSION = '1.0.8'; //IF THIS ISNT UPDATED YOU GONNA HAVE A BAD TIME
  // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  const CACHE_NAME = `sweatsync-cache-v${CACHE_VERSION}`;
  log('Service Worker Version:', CACHE_VERSION);
  

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

// Helper function to generate URLs (same as in notifications.ts)
function generateUrl(pattern: string, data: Record<string, any>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key) => data[key] || '');
}
interface CustomNotification extends Notification {
  actions?: {
    action: string;
    title: string;
    url?: string;
  }[];
}
interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface CustomNotificationOptions extends NotificationOptions {
  actions?: NotificationAction[];
  data?: any;
  vibrate?: number[];
  tag?: string;
  renotify?: boolean;
}

self.addEventListener('install', (event: ExtendableEvent) => {
  log('Installing new service worker version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      log('Cache opened:', CACHE_NAME);
    })
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  log('Activating new service worker version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            log('Keeping current cache:', cacheName);
            return Promise.resolve();
          })
        );
      }),
      self.clients.claim().then(() => {
        log('Service worker claimed clients');
      })
    ])
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
    const config = NOTIFICATION_CONFIGS[data.type];
    if (!config) {
      console.error('No config found for notification type:', data.type);
      return;
    }

    // Generate the target URL using the pattern
    const targetUrl = generateUrl(config.urlPattern, data.data || {});

    const options: CustomNotificationOptions = {
      body: data.body,
      icon: config.icon,
      badge: config.badge,
      data: {
        ...data.data,
        type: data.type,
        url: targetUrl
      },
      requireInteraction: config.requireInteraction,
      actions: config.actions?.map(action => ({
        ...action,
        // Generate action URLs if they exist
        url: action.urlPattern ? generateUrl(action.urlPattern, data.data || {}) : targetUrl
      })),
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
  // Close the notification right away
  event.notification.close();

  const notificationData = event.notification.data;
  
  // Determine which URL to use
  let targetUrl = notificationData.url;
  
  if (event.action) {
    // Cast notification to our custom type
    const notification = event.notification as CustomNotification;
    const actionConfig = notification.actions?.find(a => a.action === event.action);
    if (actionConfig?.url) {
      targetUrl = actionConfig.url;
    }
  }

  event.waitUntil(
    (async () => {
      try {
        // Get all windows
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        // Find any existing window/tab with our URL
        const existingWindow = windowClients.find(client => 
          client.url === targetUrl
        );

        if (existingWindow) {
          // If we have an existing window, focus it and reload to ensure fresh content
          await existingWindow.focus();
          return existingWindow.navigate(targetUrl);
        } else {
          // Open new window
          const newWindow = await self.clients.openWindow(targetUrl);
          // Ensure it's focused if the API allows
          if (newWindow) await newWindow.focus();
          return newWindow;
        }
      } catch (error) {
        console.error('Error handling notification click:', error);
        // Fallback to simple window opening
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// In service-worker.ts
// Add this event listener after your other event listeners
self.addEventListener('message', (event) => {
  log('Received message:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    log('Skip waiting message received, activating worker');
    self.skipWaiting();
  }
});