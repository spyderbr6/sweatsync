// amplify/functions/sendNotificationFunction/handler.ts
import { type Handler } from "aws-lambda";
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/sendPushNotificationFunction';
import webpush from 'web-push';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

// Configure web push with VAPID details from environment
webpush.setVapidDetails(
  env.VAPID_EMAIL,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

type AppSyncEvent = {
  typeName: string;
  fieldName: string;
  arguments: {
    type: 'CHALLENGE_INVITE' | 'COMMENT' | 'DAILY_REMINDER';
    userID: string;
    title: string;
    body: string;
    data?: string;
  };
  identity: any;
  source: any;
  request: any;
  prev: { result: any };
}

export const handler: Handler<AppSyncEvent, { success: boolean }> = async (event) => {
  try {
    const { type, userID, title, body, data: dataString } = event.arguments;

    if (!userID || !title || !body || !type) {
      console.error('Invalid event payload:', event);
      return { success: false };
    }

    // Parse the data string if it exists
    const data = dataString ? JSON.parse(dataString) : {};

    // Get all subscriptions for the user
    const subscriptions = await client.models.PushSubscription.list({
      filter: { userID: { eq: userID } }
    });

    if (!subscriptions.data.length) {
      console.log(`No push subscriptions found for user ${userID}`);
      return { success: false };
    }
    console.log('Found subscriptions:', JSON.stringify(subscriptions.data, null, 2));


    // Create notification record
    const notificationResult = await client.models.Notification.create({
      userID,
      title,
      body,
      type,
      data: dataString,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    if (!notificationResult.data?.id) {
      throw new Error('Failed to create notification record');
    }

    const notificationId = notificationResult.data.id;

    // Send to all user's subscriptions (multiple devices)
    const pushPromises = subscriptions.data.map(async (sub) => {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) {
        console.error('Invalid subscription data:', sub);
        return false;
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      const pushPayload = JSON.stringify({
        title,
        body,
        data: { ...data, notificationId, type }
      });
      console.log('Attempting to send push with payload:', pushPayload);



      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        console.log('Successfully sent notification to endpoint:', sub.endpoint);

        return true;
      } catch (error) {
        console.error('Error sending push notification:', error);
        
        // If subscription is invalid, remove it
        if ((error as any).statusCode === 410) {
          await client.models.PushSubscription.delete({
            id: sub.id
          });
        }
        return false;
      }
    });

    // Wait for all notifications to be sent
    const results = await Promise.all(pushPromises);
    const successCount = results.filter(Boolean).length;

    // Update notification status
    await client.models.Notification.update({
      id: notificationId,
      status: successCount > 0 ? 'SENT' : 'FAILED',
      sentAt: successCount > 0 ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    });

    return { success: successCount > 0 };

  } catch (error) {
    console.error('Error in push notification lambda:', error);
    return { success: false };
  }
};