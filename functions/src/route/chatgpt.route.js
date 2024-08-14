import express from 'express';
import { ImgaeToVideo } from '../api/chatgpt/controller/chatgpt.controller.js';

export const chatGptRouter = express.Router();

chatGptRouter.post("/test",ImgaeToVideo);