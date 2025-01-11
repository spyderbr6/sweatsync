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

    // Check for existing registration
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      if (registration) {
        console.log('[SW Update] Found existing registration:', {
          state: registration.installing ? 'installing' :
                 registration.waiting ? 'waiting' :
                 registration.active ? 'active' : 'unknown'
        });
        
        if (registration.waiting) {
          console.log('[SW Update] Found waiting worker');
          setNewWorker(registration.waiting);
          setUpdateAvailable(true);
          // Don't automatically activate - wait for user interaction
        }

        registration.addEventListener('updatefound', () => {
          console.log('[SW Update] Update found for existing registration');
          const installingWorker = registration.installing;
          
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              console.log('[SW Update] Worker state changed to:', installingWorker.state);
              if (installingWorker.state === 'installed') {
                setUpdateAvailable(true);
                setNewWorker(installingWorker);
              }
            });
          }
        });
      }
    });

    // Update the controllerchange handler
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Update] Controller changed, refreshing:', refreshing);
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const forceUpdate = async () => {
    try {
      console.log('[SW Update] Starting force update');
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[SW Update] No registration found');
        return;
      }

      if (registration.waiting) {
        console.log('[SW Update] Activating waiting worker');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // The controllerchange event will trigger the page reload
        return;
      }

      console.log('[SW Update] No waiting worker found');
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