import { useState, useEffect } from 'react';

interface UseServiceWorkerUpdate {
  updateAvailable: boolean;
  forceUpdate: () => Promise<void>;
  newWorker: ServiceWorker | null;
}

export function useServiceWorkerUpdate(): UseServiceWorkerUpdate {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const installingWorker = registration.installing;
      
      if (installingWorker) {
        setNewWorker(installingWorker);
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New content available, showing update notification');
            setUpdateAvailable(true);
          }
        });
      }
    };

    // Check for existing registration
    navigator.serviceWorker.getRegistration().then(existingRegistration => {
      if (existingRegistration) {
        console.log('Found existing service worker:', existingRegistration);
        
        // Check if there's a waiting worker
        if (existingRegistration.waiting) {
          console.log('New version waiting to activate');
          setNewWorker(existingRegistration.waiting);
          setUpdateAvailable(true);
        }

        existingRegistration.addEventListener('updatefound', () => {
          console.log('Update found for service worker');
          handleUpdateFound(existingRegistration);
        });

      } else {
        // Only register if there's no existing registration
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('SW registered:', registration);
          
          registration.addEventListener('updatefound', () => {
            console.log('Update found for service worker');
            handleUpdateFound(registration);
          });
        }).catch(error => {
          console.error('SW registration failed:', error);
        });
      }
    });

    // Add reload control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        console.log('New service worker activated, reloading page');
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const forceUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      // Get current registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('No Service Worker registration found');
      }

      // Unregister current service worker
      await registration.unregister();
      
      // Clear all caches
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));

      // Register new service worker
      await navigator.serviceWorker.register('/service-worker.js');
      
      // Reload the page to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error forcing update:', error);
      throw error;
    }
  };

  return {
    updateAvailable,
    forceUpdate,
    newWorker
  };
}