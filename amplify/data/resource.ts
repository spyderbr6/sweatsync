import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  // Existing PostforWorkout model
  PostforWorkout: a.model({
    content: a.string(),
    url: a.string(),
    username: a.string(),
    userID: a.string(),
    thumbsUp: a.integer().default(0),
    smiley: a.integer().default(0),
    trophy: a.integer().default(0)
  }).authorization((allow) => [allow.publicApiKey()]),

  // New Friend Request Model
  FriendRequest: a.model({
    sender: a.string(), // User ID of sender
    recipient: a.string(), // User ID of recipient
    status: a.enum(['PENDING', 'ACCEPTED', 'DECLINED']),
    createdAt: a.datetime()
  }).authorization((allow) => [
    allow.authenticated().to(['create', 'read', 'update'])
  ]),

  // New Friends Model
  Friend: a.model({
    user: a.string(), // User ID
    friendUser: a.string(), // Friend's User ID
    friendshipDate: a.datetime()
  }).authorization((allow) => [
    allow.authenticated().to(['create', 'read'])
  ])
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