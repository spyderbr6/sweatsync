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
    challengeType: a.enum(['none', 'PUBLIC', 'GROUP', 'PERSONAL', 'FRIENDS','DAILY']), 
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
    updatedAt: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()])
    .secondaryIndexes
    ((index) => [
      index('status')
        .name('byStatus')
        .sortKeys(["createdAt"])
    ]),




  // Keep DailyChallenge separate for time-series data
  DailyChallenge: a.model({
    id: a.string().required(),
    challengeId: a.string().required(),
    creatorId: a.string().required(),
    title: a.string().required(),
    description: a.string().required(),
    date: a.datetime().required(),
    pointsAwarded: a.integer().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  }).authorization((allow) => [allow.publicApiKey()]),


  ChallengeParticipant: a.model({
      challengeID: a.string().required(), //reference to Challenge model
      userID: a.string().required(),
      status: a.enum(['ACTIVE', 'COMPLETED', 'DROPPED', 'PENDING']),
      points: a.integer().default(0),
      workoutsCompleted: a.integer().default(0),
      joinedAt: a.datetime(),
      completedAt: a.datetime(),
      updatedAt: a.datetime(),
      invitedAt: a.datetime(),
      invitedBy: a.string()
    }).authorization((allow) => [allow.publicApiKey()]),

  PostChallenge: a.model({
    postId: a.string(),
    challengeId: a.string(),
    userId: a.string(),
    timestamp: a.datetime(),
    validated: a.boolean().default(false),
    validationComment: a.string()
  }).authorization((allow) => [allow.publicApiKey()]),

  Comment: a.model({
    postId: a.string(),
    userId: a.string(),
    content: a.string(),
    timestamp: a.datetime(),
    updatedAt: a.datetime(),
    createdAt: a.datetime()
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
  }).authorization((allow) => [allow.publicApiKey()]),

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
