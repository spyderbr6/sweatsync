// amplify/functions/sendNotificationFunction/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const sendPushNotificationFunction = defineFunction({
  name: 'sendPushNotificationFunction', 
  entry: './handler.ts',
  environment: {
    VAPID_EMAIL: process.env.VITE_VAPID_EMAIL ?? '',
    VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY ?? '',
    VAPID_PRIVATE_KEY: process.env.VITE_VAPID_PRIVATE_KEY ?? ''
  }
});