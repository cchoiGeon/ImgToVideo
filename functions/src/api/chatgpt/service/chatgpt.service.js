import { openai } from "../../../../config/chatgpt.config.js";
import { PassThrough } from 'stream';
import { bucket } from "../../../../config/firebase.config.js";
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';

// ffmpeg 및 ffprobe 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export async function testService(img_url) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [{ 
                role: "user", 
                content: [
                    {
                        type: "text",
                        text: "이 그림을 한글로 자세히 설명해줘",
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: img_url
                        }
                    }

                ]
            }],
            max_tokens: 2000,
        });
        return response.choices[0]?.message.content;
    } catch (error) {
        console.error('Error calling GPT-4:', error);
        return false;
    }
}

export const test2Service = async (data) => {
    const tempDir = path.resolve('./temp');
    let tempFilePath;

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        tempFilePath = path.resolve(tempDir, `${Date.now()}-output.mp3`);
        
        const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: data,
        });

        const audioStream = new PassThrough();
        response.body.pipe(audioStream);

        // 스트림을 로컬 파일에 저장
        const writeStream = fs.createWriteStream(tempFilePath);
        audioStream.pipe(writeStream);

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // FFmpeg를 사용하여 오디오 길이 확인
        const duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
                if (err) {
                    return reject(err);
                }
                resolve(metadata.format.duration);
            });
        });

        // Firebase Storage에 파일 업로드
        const destination = `audio/${Date.now()}-output.mp3`;
        const file = bucket.file(destination);

        await new Promise((resolve, reject) => {
            fs.createReadStream(tempFilePath)
                .pipe(file.createWriteStream({
                    metadata: {
                        contentType: 'audio/mpeg',
                    },
                    public: true,
                }))
                .on('finish', resolve)
                .on('error', reject);
        });

        // Firebase Storage의 공개 URL 반환
        const publicUrl = file.publicUrl();

        // 오디오 길이와 URL 반환
        return { publicUrl, duration };

    } catch (error) {
        console.error('Error processing TTS:', error);
        return false;

    } finally {
        // 임시 파일 삭제
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
};
