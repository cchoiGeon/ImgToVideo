import { openai } from "../../../../config/chatgpt.config.js";
import { PassThrough } from 'stream';
import { bucket } from "../../../../config/firebase.config.js";
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import axios from "axios";

// ffmpeg 및 ffprobe 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export async function AnalyzeImg(img_urls) {
    try {
        console.log(img_urls)
        const results = [];

        for (let img_url of img_urls) {
            console.log("img_url : ", img_url);

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

            const description = response.choices[0]?.message.content;

            if (description) {
                results.push({ img_url, description });
            } else {
                results.push({ img_url, description: "Description not available" });
            }
        }

        const descriptions = results.map(item => item.description);
        const img_url_data = results.map(item => item.img_url);
        
        const ttsData = await TextToSpeech(descriptions);

        const durations = ttsData.map(item => parseInt(item.duration + 1));
        console.log(durations);
        
        await createVideoFromImages(img_url_data, durations);

        return results;
    } catch (error) {
        console.error('Error calling GPT-4:', error);
        return false;
    }
}

export const TextToSpeech = async (datas) => {
    const tempDir = path.resolve('./temp');
    const results = [];
    
    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        for (let data of datas) {
            try {
                console.log("Processing data: ", data);
                const tempFilePath = path.resolve(tempDir, `${Date.now()}-output.mp3`);

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
                results.push({ publicUrl, duration });

                // 임시 파일 삭제
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            } catch (error) {
                console.error('Error processing data:', error);
                // 개별 오류에 대해 계속 실행되도록 설정
                continue;
            }
        }

        console.log("TTS results: ", results);

        // temp 폴더 삭제
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return results;
    } catch (error) {
        console.error('Error processing TTS:', error);
        return false;
    }
};

export async function createVideoFromImages(img_urls, durations) {
    const tempDir = './temps'; // 임시 폴더 경로
    const outputDir = './output'; // 출력 폴더 경로
    const outputVideo = path.resolve(outputDir, 'video.mp4'); // 최종 출력 비디오 경로

    // Firebase Storage URL과 각 이미지의 지속 시간을 설정
    const images = img_urls.map((url, index) => ({
        url,
        duration: durations[index],
    }));

    // 이미지 다운로드 함수
    async function downloadImage(url, outputPath) {
        const response = await axios({
            url,
            responseType: 'stream',
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    // 이미지를 로컬에 다운로드한 후, 비디오 생성
    try {
        // temps 디렉토리 생성
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // output 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // 다운로드한 이미지 경로를 저장할 배열
        const downloadedImages = [];

        // 모든 이미지를 로컬로 다운로드
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const outputPath = path.resolve(tempDir, `image-${i}.jpeg`);
            await downloadImage(image.url, outputPath);
            downloadedImages.push({ path: outputPath, duration: image.duration });
        }

        // FFmpeg 명령 생성
        let command = ffmpeg();
        let filterComplex = '';

        downloadedImages.forEach((image, index) => {
            command = command.input(image.path);
            filterComplex += `[${index}:v]fps=25,scale=1920:1080,setsar=1,loop=${image.duration * 25}:1:0,setpts=N/(25*TB)[v${index}];`;
        });
        filterComplex += downloadedImages.map((_, index) => `[v${index}]`).join('') + `concat=n=${downloadedImages.length}:v=1:a=0[outv]`;

        command = command
            .complexFilter(filterComplex)
            .outputOptions('-map', '[outv]')
            .output(outputVideo)
            .videoCodec('libx264')
            .on('end', () => {
                console.log('비디오 생성 완료!');
                
                // 임시 파일 삭제
                downloadedImages.forEach(image => {
                    if (fs.existsSync(image.path)) {
                        fs.unlinkSync(image.path);
                    }
                });

                // temp 폴더 삭제
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    console.log("Temporary directory deleted");
                }
            })
            .on('error', (err) => console.error('비디오 생성 중 오류 발생:', err.message))
            .run();
    } catch (error) {
        console.error('이미지 다운로드 중 오류 발생:', error.message);

        // 임시 파일과 폴더 삭제 시도
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                fs.unlinkSync(path.join(tempDir, file));
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log("Temporary directory deleted after error");
        }
    }
}
