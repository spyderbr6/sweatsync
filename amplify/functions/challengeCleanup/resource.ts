// amplify/functions/challengeCleanup/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const challengeCleanup = defineFunction({
  name: 'challengeCleanup', 
  entry: './handler.ts',
  schedule: [
    // Runs at midnight UTC daily
    "0 6 * * ? *" // 5:00 AM UTC
  ]
});