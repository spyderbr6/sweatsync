// amplify/functions/processReminders/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const processReminders = defineFunction({
  name: 'processReminders', 
  entry: './handler.ts', 
  schedule: [
    // Run at the beginning of every hour
    "0 * * * ? *"  // Every hour at minute 0
  ]
});