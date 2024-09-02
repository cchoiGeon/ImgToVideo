import express from 'express';
import { test } from '../api/test/test.controller.js';

export const testRouter = express.Router();

testRouter.post("/test",test);