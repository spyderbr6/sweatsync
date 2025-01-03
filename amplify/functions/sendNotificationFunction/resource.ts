// amplify/functions/sendNotificationFunction/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const sendPushNotificationFunction = defineFunction({
  name: 'sendPushNotificationFunction', 
  entry: './handler.ts',
  environment: {
    VITE_VAPID_EMAIL: process.env.VITE_VAPID_EMAIL!,
    VITE_VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY!,
    VITE_VAPID_PRIVATE_KEY: process.env.VITE_APID_PRIVATE_KEY!
  }
});