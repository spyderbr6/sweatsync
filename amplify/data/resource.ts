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
  }).authorization((allow) => [allow.authenticated()]),

  FriendRequest: a.model({
    sender: a.string(),
    recipient: a.string(),
    status: a.enum(['PENDING', 'ACCEPTED', 'DECLINED']),
    createdAt: a.datetime()
  }).authorization((allow) => [allow.authenticated()]
    // Allow authenticated users to create requests and read them
    // allow.authenticated().to(['create', 'read', 'update']),
    // Allow owners (senders) to manage their requests
    // allow.owner().to(['create','read', 'update', 'delete'])
    //]
  ),

  Friend: a.model({
    user: a.string(),
    friendUser: a.string(),
    friendshipDate: a.datetime()
  }).authorization((allow) => [allow.authenticated()]
  )
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