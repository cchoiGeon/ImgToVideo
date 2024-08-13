import express from 'express';
import { test, test2 } from '../api/chatgpt/controller/chatgpt.controller.js';

export const chatGptRouter = express.Router();

chatGptRouter.post("/test",test);
chatGptRouter.post("/test2",test2);