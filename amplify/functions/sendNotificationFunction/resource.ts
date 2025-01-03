// amplify/functions/sendNotificationFunction/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const sendPushNotificationFunction = defineFunction({
  name: 'sendPushNotificationFunction', 
  entry: './handler.ts'
});