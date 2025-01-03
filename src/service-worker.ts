 
  // service-worker.ts
  /// <reference lib="webworker" />
  import { precacheAndRoute } from 'workbox-precaching';
  import { registerRoute } from 'workbox-routing';
  import { CacheFirst, NetworkFirst } from 'workbox-strategies';
  import { ExpirationPlugin } from 'workbox-expiration';
  
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
  vibrate?: number[];
  tag?: string;
  data?: any;
}

const CACHE_NAME = 'sweatsync-cache-v1';

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

self.addEventListener('activate', (_: ExtendableEvent) => {
  console.log('Service Worker activating.');
});

// Handle push events
self.addEventListener('push', (event: PushEvent) => {
  console.log('==== PUSH EVENT RECEIVED ====');
  console.log('Push event timestamp:', new Date().toISOString());
  console.log('ServiceWorker state:', self.registration.active?.state);
  
  if (!event.data) {
    console.log('Push event received but no data');
    return;
  }

  try {
    console.log('Raw push data:', event.data.text());
    const data = event.data.json();
    console.log('Parsed push data:', data);
    
    // Move notification options into a separate const for debugging
    const options: CustomNotificationOptions = {
      body: data.body,
      icon: '/picsoritdidnthappen.webp',
      badge: '/picsoritdidnthappen.webp',
      data: {
        ...data.data,
        url: self.registration.scope + 'challenge/' + data.data.challengeId
      },
      requireInteraction: true,
      actions: data.actions || [],
      // Add these to make notification more noticeable
      vibrate: [200, 100, 200],
      tag: 'challenge-notification'
    };

    console.log('About to show notification with:', {
      title: data.title,
      options: JSON.stringify(options, null, 2)
    });

    event.waitUntil(
      self.registration.showNotification(data.title, options)
        .then(() => console.log('✅ Notification shown successfully'))
        .catch(error => {
          console.error('❌ Error showing notification:', error);
          if (error instanceof Error) {
            console.error('Error details:', {
              message: error.message,
              stack: error.stack
            });
          }
        })
    );
  } catch (err: unknown) {
    console.error('Error processing push event:', err);
    if (err instanceof Error) {
      console.error('Stack trace:', err.stack);
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // Handle notification click
  if (event.notification.data) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data as string)
    );
  }
});