 
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