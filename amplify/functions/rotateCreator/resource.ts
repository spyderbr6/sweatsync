// amplify/functions/rotateCreator/resource.ts

import { defineFunction } from '@aws-amplify/backend';

export const rotateCreator = defineFunction({
  name: 'rotateCreator', 
  entry: './handler.ts',
  schedule: [
    // Runs at midnight UTC daily
    "every day"
  ]
});