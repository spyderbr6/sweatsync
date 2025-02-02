import { defineFunction, secret } from '@aws-amplify/backend';


export const imageAnalysis = defineFunction({
    name: 'imageAnalysis',         // Name for your Lambda function
    entry: './handler.ts',           // Path to your Lambda function code

    environment: {
        // This references the secret you stored in Amplify named "OPENAI_API_KEY"
        OPENAI_API_KEY: secret('OPENAI_API_KEY')
    },
    timeoutSeconds: 30,  // Increase timeout to 30 seconds
    memoryMB: 512       // Also increasing memory to ensure enough resources
});

