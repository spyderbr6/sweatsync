import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== post workout schema ===============================================================
The section
=========================================================================*/
const schema = a.schema({
  PostforWorkout: a
    .model({
      content: a.string(),
      url: a.string(),
      username: a.string(), 
      thumbsUp: a.integer().default(0),
      smiley: a.integer().default(0),
      trophy: a.integer().default(0)    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

