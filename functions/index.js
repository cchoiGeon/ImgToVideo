import functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { init } from './db/index.js';

// 사용자 정의 모듈 불러오기 
import { chatGptRouter } from './src/route/chatgpt.route.js';
import { testRouter } from './src/route/test.route.js';

const app = express();

await init();

app.use(cors());

app.use(cookieParser());
app.use(express.json()); // JSON 요청을 처리할 수 있도록 설정
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청을 처리할 수 있도록 설정

app.use("/",testRouter)
app.use("/chatGpt", chatGptRouter);

export const api = functions.region("asia-northeast3").https.onRequest(app);
