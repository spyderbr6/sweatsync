import { defineFunction, secret } from '@aws-amplify/backend';


export const imageAnalysis = defineFunction({
    name: 'imageAnalysis',         // Name for your Lambda function
    entry: './handler.ts',           // Path to your Lambda function code

    environment: {
        // This references the secret you stored in Amplify named "OPENAI_API_KEY"
        OPENAI_API_KEY: secret('OPENAI_API_KEY')
    }
});
console.log('OPENAI_API_KEY', process.env.OPENAI_API_KEY);

