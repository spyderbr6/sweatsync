//amplify/data/resource.ts

import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { rotateCreator } from "../functions/rotateCreator/resource";
import { challengeCleanup } from "../functions/challengeCleanup/resource";
import { sendPushNotificationFunction } from "../functions/sendNotificationFunction/resource";
import { processReminders } from "../functions/processReminders/resource";

const schema = a.schema({
  PostforWorkout: a.model({
    content: a.string(),
    url: a.string(),
    username: a.string(),
    userID: a.string(),
    thumbsUp: a.integer().default(0),
    smiley: a.integer().default(0),
    // Add new emoji counts
    strong: a.integer().default(0),    // 💪
    fire: a.integer().default(0),      // 🔥
    zap: a.integer().default(0),       // ⚡
    fist: a.integer().default(0),      // 👊
    target: a.integer().default(0),    // 🎯
    star: a.integer().default(0),      // ⭐
    rocket: a.integer().default(0),    // 🚀
    clap: a.integer().default(0),      // 👏
    trophy: a.integer().default(0),  //trophy
    challengeIds: a.string().array() // Store as JSON array of IDs
  }).authorization((allow) => [allow.publicApiKey()]),

  Reaction: a.model({
    postId: a.string(),
    userId: a.string(),
    emoji: a.string(),
    timestamp: a.string()
  }).authorization((allow) => [allow.publicApiKey()]),

  FriendRequest: a.model({
    sender: a.string(),
    recipient: a.string(),
    status: a.enum(['PENDING', 'ACCEPTED', 'DECLINED']),
    createdAt: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()]),

  Friend: a.model({
    user: a.string().required(),
    friendUser: a.string().required(),
    friendshipDate: a.datetime().required()
  }).authorization((allow) => [allow.publicApiKey()]),

  Challenge: a.model({
    // Base Challenge fields 
    id: a.string().required(),
    title: a.string().required(),
    description: a.string().required(),
    reward: a.string(),
    challengeType: a.enum(['none', 'PUBLIC', 'GROUP', 'PERSONAL', 'FRIENDS', 'DAILY']),
    status: a.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'DRAFT', 'CANCELLED']),
    startAt: a.datetime().required(),
    endAt: a.datetime().required(),
    createdBy: a.string(),
    totalWorkouts: a.integer(),
    basePointsPerWorkout: a.integer(),
    isActive: a.boolean(),

    // Group Challenge specific fields (only populated for group type)
    maxPostsPerDay: a.integer(),
    maxPostsPerWeek: a.integer(),
    dailyChallenges: a.boolean(),
    rotationIntervalDays: a.integer(),
    currentCreatorId: a.string(),
    dailyChallengePoints: a.integer(),

    //Daily Challenge specific fields
    parentChallengeId: a.string(),     // Link to parent group challenge
    isDailyChallenge: a.boolean(),     // Flag for daily challenges
    creatorRotation: a.boolean(),      // For parent challenge - indicates daily creator rotation
    nextCreatorId: a.string(),         // For parent challenge - tracks next creator
    nextRotationDate: a.string(),      // For parent challenge - when to rotate creator

    // Timestamps
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    updatedBy: a.string()
  }).authorization((allow) => [allow.publicApiKey()])
    .secondaryIndexes
    ((index) => [
      index('status')
        .name('byStatus')
        .sortKeys(["createdAt"])
    ]),

  ChallengeParticipant: a.model({
    challengeID: a.string().required(), //reference to Challenge model
    userID: a.string().required(),
    status: a.enum(['ACTIVE', 'COMPLETED', 'DROPPED', 'PENDING', 'DECLINED']),
    points: a.integer().default(0),
    workoutsCompleted: a.integer().default(0),
    joinedAt: a.datetime(),
    completedAt: a.datetime(),
    updatedAt: a.datetime(),
    invitedAt: a.datetime(),
    invitedBy: a.string(),
    dropReason: a.string(), //Reason the user is marked as dropped. could be user, or system, etc.
    updatedBy: a.string() //User who last updated the record
  }).authorization((allow) => [allow.publicApiKey()]),

  PostChallenge: a.model({
    postId: a.string(),
    challengeId: a.string(),
    userId: a.string(),
    timestamp: a.datetime(),
    validated: a.boolean().default(false),
    validationComment: a.string(),
    points: a.integer().default(0)
  }).authorization((allow) => [allow.publicApiKey()]),

  Comment: a.model({
    postId: a.string(),
    userId: a.string(),
    content: a.string(),
    timestamp: a.datetime(),
    updatedAt: a.datetime(),
    createdAt: a.datetime(),
    taggedUserIds: a.string().array(), // Store array of tagged friend IDs
    postOwnerId: a.string() // To track post owner for notifications
  }).authorization((allow) => [allow.publicApiKey()]),

  //Store user info just for searching/retrieval
  //REMEMBER TO ONLY STORE NON-PII!
  User: a.model({
    id: a.string().required(),
    email: a.string(),  // optional by default
    username: a.string().required(),
    preferred_username: a.string(),  // optional by default
    picture: a.string(),  // optional by default
    pictureUrl: a.string(),  // optional by default
    pictureUpdatedAt: a.datetime(),  // optional by default
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    lowercasename: a.string().required(),
    hasCompletedOnboarding: a.boolean().default(false),
    reminderPreferences: a.json()
  }).authorization((allow) => [allow.publicApiKey()]),

  //PUSH NOTIFICATION SETUP
  PushSubscription: a.model({
    userID: a.string().required(),
    endpoint: a.string().required(),
    p256dh: a.string().required(),  // Public key for encryption
    auth: a.string().required(),    // Auth secret
    platform: a.string(),           // Optional - to track different devices/browsers
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
  }).authorization((allow) => [allow.publicApiKey()]),

  Notification: a.model({
    userID: a.string().required(),
    title: a.string().required(),
    body: a.string().required(),
    type: a.string().required(), // REFER TO TYPES\notifications.ts for type reference and logic 
    data: a.string(), // JSON string for additional data
    status: a.string().required(), // 'PENDING', 'SENT', 'FAILED'
    sentAt: a.datetime(),
    createdAt: a.datetime().required(),
    readAt: a.datetime(), // Optional, when the notification was read
    updatedAt: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()]),

  //Schema to track reminders timing and types
  ReminderSchedule: a.model({
    userId: a.string().required(),
    challengeId: a.string().required(),
    type: a.enum(['DAILY_POST', 'GROUP_POST', 'CREATOR_ROTATION']),
    scheduledTime: a.datetime().required(),  // When to send the reminder
    repeatDaily: a.boolean().default(true),  // If this should repeat
    timePreference: a.string(),  // Store time as "HH:mm" format
    secondPreference: a.string(),  // Store time as "HH:mm" format
    timezone: a.string(),  // Store IANA timezone, e.g., "America/New_York"
    status: a.enum(['PENDING', 'SENT', 'CANCELLED']),
    lastSent: a.datetime(),  // Track last reminder
    nextScheduled: a.datetime(),  // Next scheduled reminder
    enabled: a.boolean().default(false),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
  }).authorization((allow) => [allow.publicApiKey()]),

  PersonalGoal: a.model({
    userID: a.string().required(),
    type: a.enum(['CALORIE', 'WEIGHT', 'CUSTOM']),
    name: a.string().required(),
    target: a.float().required(),
    currentValue: a.float(),
    startDate: a.datetime().required(),
    endDate: a.datetime(),
    streakCount: a.integer().default(0),
    bestStreak: a.integer().default(0),
    achievementsEnabled: a.boolean().default(true),
    achievementThresholds: a.json(), // Store as stringified JSON
    status: a.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
  }).authorization((allow) =>[
    allow.owner(),
    allow.publicApiKey()
  ]).secondaryIndexes((index) => [
    // Index for querying active goals by type
    index("userID")
      .sortKeys(['type'])
      .queryField('listGoalsByType')
      .name ('byUserAndType')
  ]),

  DailyLog: a.model({
    userID: a.string().required(),
    date: a.string().required(), // YYYY-MM-DD format
    weight: a.float(),
    calories: a.float(),
    meals: a.json(), // Store as stringified JSON
    notes: a.string(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
  }).authorization((allow) => [
    allow.publicApiKey()
  ]).secondaryIndexes((index) => [
    // Index for querying logs by date range
    index('userID')
      .sortKeys(['date'])
      .queryField('listLogsByDate')
      .name('byUserAndDate')
  ]),

  rotateCreator: a
    .query()
    .arguments({
      challengeId: a.string().required()
    })
    .returns(a.boolean())
    .handler(a.handler.function(rotateCreator))
    .authorization((allow) => [allow.publicApiKey()]),

  challengeCleanup: a
    .query()
    .arguments({ challengeId: a.string().required() }
    )
    .returns(a.boolean())
    .handler(a.handler.function(challengeCleanup))
    .authorization((allow) => [allow.publicApiKey()]),

  sendPushNotificationFunction: a
    .query()
    .arguments({
      type: a.string().required(),
      userID: a.string().required(),
      title: a.string().required(),
      body: a.string().required(),
      data: a.string()
    })
    .returns(a.boolean())
    .handler(a.handler.function(sendPushNotificationFunction))
    .authorization((allow) => [allow.publicApiKey()]),

  processReminders: a
    .query()
    .arguments({
      startTime: a.string().required(),  // ISO timestamp to process
      endTime: a.string().required()     // ISO timestamp to process until
    })
    .returns(a.boolean())
    .handler(a.handler.function(processReminders))
    .authorization((allow) => [allow.publicApiKey()]),


}).authorization((allow) => [
  /**
   * 1) Let the function be invoked if you actually want to call it
   *    as a query from a client. If you *only* run it on a schedule
   *    and never from a client, you could remove or minimize these.
   */
  allow.resource(rotateCreator).to(["query", "listen", "mutate"]),
  allow.resource(challengeCleanup).to(["query", "listen", "mutate"]),
  allow.resource(sendPushNotificationFunction).to(["query", "listen", "mutate"]),
  allow.resource(processReminders).to(["query", "listen", "mutate"])
]);



export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
