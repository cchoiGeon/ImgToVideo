import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config(); // dotenv 초기화
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION
});