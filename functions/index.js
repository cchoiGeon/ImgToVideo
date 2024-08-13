import functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// 사용자 정의 모듈 불러오기 
import { chatGptRouter } from './src/route/chatgpt.route.js';

const app = express();

app.use(cors());

app.use(cookieParser());
app.use(express.json()); // JSON 요청을 처리할 수 있도록 설정
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청을 처리할 수 있도록 설정

app.use("/chatGpt", chatGptRouter);

export const api = functions.region("asia-northeast3").https.onRequest(app);
