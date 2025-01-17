import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { rotateCreator } from './functions/rotateCreator/resource';
import { challengeCleanup } from './functions/challengeCleanup/resource';
import { sendPushNotificationFunction } from './functions/sendNotificationFunction/resource';
import { processReminders } from './functions/processReminders/resource';

defineBackend({
  auth,
  data,
  storage,
  rotateCreator,
  challengeCleanup,
  sendPushNotificationFunction,
  processReminders
});
