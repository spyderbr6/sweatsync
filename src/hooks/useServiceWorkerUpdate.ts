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
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Update] Service workers not supported');
      return;
    }

    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const installingWorker = registration.installing;
      
      if (installingWorker) {
        console.log('[SW Update] New worker installing, current controller:', !!navigator.serviceWorker.controller);
        setNewWorker(installingWorker);
        
        installingWorker.addEventListener('statechange', () => {
          console.log('[SW Update] Worker state changed to:', installingWorker.state);
          
          if (installingWorker.state === 'installed') {
            console.log('[SW Update] Worker installed, controller exists:', !!navigator.serviceWorker.controller);
            if (navigator.serviceWorker.controller) {
              console.log('[SW Update] New content available, showing notification');
              setUpdateAvailable(true);
            } else {
              console.log('[SW Update] Service Worker installed for the first time');
              setUpdateAvailable(false);
            }
          }
        });
      }
    };

    // Check for existing registration
    navigator.serviceWorker.getRegistration().then(existingRegistration => {
      if (existingRegistration) {
        console.log('[SW Update] Found existing registration:', {
          state: existingRegistration.installing ? 'installing' :
                 existingRegistration.waiting ? 'waiting' :
                 existingRegistration.active ? 'active' : 'unknown'
        });
        
        if (existingRegistration.waiting) {
          console.log('[SW Update] Found waiting worker');
          setNewWorker(existingRegistration.waiting);
          setUpdateAvailable(true);
        }

        existingRegistration.addEventListener('updatefound', () => {
          console.log('[SW Update] Update found for existing registration');
          handleUpdateFound(existingRegistration);
        });
      }
    });

    // Add reload control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Update] Controller changed, refreshing:', refreshing);
      if (!refreshing) {
        refreshing = true;
        console.log('[SW Update] Reloading page');
        window.location.reload();
      }
    });
  }, []);

  const forceUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Update] Cannot force update - service workers not supported');
      return;
    }

    try {
      console.log('[SW Update] Starting force update');
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[SW Update] No registration found');
        return;
      }

      console.log('[SW Update] Unregistering current worker');
      await registration.unregister();
      
      console.log('[SW Update] Clearing caches');
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => {
        console.log('[SW Update] Clearing cache:', key);
        return caches.delete(key);
      }));

      console.log('[SW Update] Registering new worker');
      await navigator.serviceWorker.register('/service-worker.js');
      
      console.log('[SW Update] Force update complete, reloading');
      window.location.reload();
    } catch (error) {
      console.error('[SW Update] Force update failed:', error);
      throw error;
    }
  };

  return {
    updateAvailable,
    forceUpdate,
    newWorker
  };
}