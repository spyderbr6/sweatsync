// src/hooks/usePushNotifications.ts
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    'default'
  );
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Check initial permission state
  useEffect(() => {
    const checkCurrentDeviceSubscription = async () => {
      if (!userId) return;
  
      try {
        // Get current browser subscription
        const registration = await navigator.serviceWorker.ready;
        const browserSub = await registration.pushManager.getSubscription();
  
        // If we have a browser subscription, check if it exists in database
        if (browserSub) {
          const dbSubs = await client.models.PushSubscription.list({
            filter: { 
              userID: { eq: userId },
              endpoint: { eq: browserSub.endpoint }
            }
          });
  
          // Only set permission to granted if this device's subscription exists
          if (dbSubs.data.length > 0) {
            setPermission('granted');
            setSubscription(browserSub);
          } else {
            setPermission('default');
            setSubscription(null);
          }
        } else {
          setPermission('default');
          setSubscription(null);
        }
  
      } catch (error) {
        console.error('Error checking device subscription:', error);
        setError(error instanceof Error ? error.message : 'Failed to check notification status');
      }
    };
  
    checkCurrentDeviceSubscription();
  }, [userId]);
  // Function to convert subscription to database format
  const saveSubscription = async (sub: PushSubscription) => {
    if (!userId) {
      throw new Error('User ID is required to save subscription');
    }

    const subscriptionJSON = sub.toJSON();
    
    // Validate required subscription data
    if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
      throw new Error('Invalid subscription data');
    }

    try {
      await client.models.PushSubscription.create({
        userID: userId,
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
        platform: 'web',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving subscription:', err);
      throw err;
    }
  };

  // Request permission and subscribe to push notifications
  const requestPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setError('This browser does not support notifications');
      return;
    }

    if (!userId) {
      setError('User must be logged in to enable notifications');
      return;
    }

    try {

      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        
        // Get push subscription
        let sub = await registration.pushManager.getSubscription();
        
        if (!sub) {
          // Create new subscription
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
          });
        }

        setSubscription(sub);
        await saveSubscription(sub);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async () => {
    console.log('Unsubscribing from push notifications');
    if (!userId) {
      setError('User must be logged in to manage notifications');
      return;
    }

    try {
      // Get current subscription
      console.log('Getting current subscription');
      const registration = await navigator.serviceWorker.ready;
      console.log('Registration:', registration);
      const sub = await registration.pushManager.getSubscription();
console.log('Subscription:', sub);
      if (sub) {
        // Unsubscribe from push manager
        await sub.unsubscribe();

        // Delete from database
        const subscriptions = await client.models.PushSubscription.list({
          filter: {
            userID: { eq: userId },
            endpoint: { eq: sub.endpoint }
          }
        });

        // Delete all matching subscriptions
        await Promise.all(
          subscriptions.data.map(subscription =>
            client.models.PushSubscription.delete({
              id: subscription.id
            })
          )
        );

        setSubscription(null);
        setPermission('default');
      }
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable notifications');
    }
  };

  return {
    permission,
    error,
    subscription,
    requestPermission,
    unsubscribe
  };
}