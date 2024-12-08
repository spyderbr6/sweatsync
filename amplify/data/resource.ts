import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  PostforWorkout: a.model({
    content: a.string(),
    url: a.string(),
    username: a.string(),
    userID: a.string(),
    thumbsUp: a.integer().default(0),
    smiley: a.integer().default(0),
    trophy: a.integer().default(0)
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
    totalWorkouts: a.integer().default(0),
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
