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
    title: a.string().required(),
    description: a.string().required(),
    startAt: a.datetime(),
    endAt: a.datetime(),
    reward: a.string(),
    totalWorkouts: a.integer().default(1), //total workouts needing completed in the timeframe
    challengeType: a.string().required(),
    createdAt: a.datetime(),    // capture when the challenge was created
    updatedAt: a.datetime(),     // capture when the challenge was last updated
    createdBy: a.string() // should reference the uID
  }).authorization((allow) => [allow.publicApiKey()]),

  ChallengeParticipant: a.model({
    challengeID: a.string().required(), //reference to Challenge model
    userID: a.string().required(),
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
  }).authorization((allow) => [allow.publicApiKey()]), 

//BASE MODEL FOR ALL CHALLENGE TYPES
  ChallengeRules: a.model({
    challengeId: a.string().required(), //reference to Challenge model
    type: a.string().required(),         // "group", "personal", "public", etc
    endDate: a.datetime().required(),
    basePointsPerWorkout: a.integer().required(),
    isActive: a.boolean().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
}).authorization((allow) => [allow.publicApiKey()]),

//SEPERATE MODEL FOR GROUP CHALLENGES
GroupChallengeRules: a.model({
    challengeRuleId: a.string().required(),  // Links to base ChallengeRules
    maxPostsPerDay: a.integer().required(),
    maxPostsPerWeek: a.integer().required(),
    dailyChallenges: a.boolean().required(),
    rotationIntervalDays: a.integer(),      // Days between creator rotation
    currentCreatorId: a.string(),           // Current daily challenge creator
    nextRotationDate: a.datetime(),         // When to switch creators
    dailyChallengePoints: a.integer(),      // Points for daily challenge completion
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
}).authorization((allow) => [allow.publicApiKey()]),

//Model for daily challenges within group challenges
DailyChallenge: a.model({
    groupChallengeId: a.string().required(), // Links to parent group challenge
    creatorId: a.string().required(),        // Who created this daily challenge
    title: a.string().required(),
    description: a.string().required(),
    date: a.datetime().required(),           // The date this challenge is for
    pointsAwarded: a.integer().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required()
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
