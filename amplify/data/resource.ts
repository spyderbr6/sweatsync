import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

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
    trophy: a.integer().default(0)  //trophy
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
    user: a.string(),
    friendUser: a.string(),
    friendshipDate: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()]),

  Challenge: a.model({
    title: a.string(),
    description: a.string(),
    startAt: a.datetime(),
    endAt: a.datetime(),
    reward: a.string(),
    totalWorkouts: a.integer().default(1), //total workouts needing completed in the timeframe
    challengeType: a.string(),
    createdAt: a.datetime(),    // capture when the challenge was created
    updatedAt: a.datetime(),     // capture when the challenge was last updated
    createdBy: a.string() // should reference the uID
  }).authorization((allow) => [allow.publicApiKey()]),

  ChallengeParticipant: a.model({
    challengeID: a.string(),
    userID: a.string(),
    status: a.enum(['ACTIVE', 'COMPLETED', 'DROPPED']),
    points: a.integer().default(0),
    workoutsCompleted: a.integer().default(0),
    joinedAt: a.datetime(),
    completedAt: a.datetime(),
    updatedAt: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()]), 

  PostChallenge: a.model({
    postId: a.string(),
    challengeId: a.string(),
    userId: a.string(),
    timestamp: a.datetime(),
    validated: a.boolean().default(false),
    validationComment: a.string()
  }).authorization((allow) => [allow.publicApiKey()])
});

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
